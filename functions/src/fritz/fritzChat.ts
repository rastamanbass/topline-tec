import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./systemPrompt";
import { getToolsForRole } from "./tools";
import type {
  FritzChatRequest,
  FritzChatResponse,
  ConversationMessage,
  KnowledgeEntry,
  ToolContext,
} from "./types";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

// ── Knowledge cache (5 min TTL) ──────────────────────────────────────────────
let knowledgeCache: KnowledgeEntry[] = [];
let knowledgeCacheTime = 0;
const KNOWLEDGE_CACHE_TTL = 5 * 60 * 1000;

async function loadKnowledge(db: FirebaseFirestore.Firestore): Promise<KnowledgeEntry[]> {
  if (Date.now() - knowledgeCacheTime < KNOWLEDGE_CACHE_TTL && knowledgeCache.length > 0) {
    return knowledgeCache;
  }
  const snap = await db.collection("fritzKnowledge").limit(100).get();
  knowledgeCache = snap.docs.map((d) => d.data() as KnowledgeEntry);
  knowledgeCacheTime = Date.now();
  return knowledgeCache;
}

// ── Rate limiting ────────────────────────────────────────────────────────────
async function checkRateLimit(db: FirebaseFirestore.Firestore, uid: string): Promise<void> {
  const ref = db.collection("fritzRateLimit").doc(uid);
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;

  const doc = await ref.get();
  const data = doc.data();
  const timestamps: number[] = (data?.timestamps || []).filter((t: number) => t > oneMinuteAgo);

  if (timestamps.length >= 30) {
    throw new HttpsError(
      "resource-exhausted",
      "Brother, más despacio — máximo 30 mensajes por minuto."
    );
  }

  timestamps.push(now);
  await ref.set({ timestamps }, { merge: true });
}

// ── Main Cloud Function ──────────────────────────────────────────────────────

export const fritzChat = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request): Promise<FritzChatResponse> => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Necesitás estar autenticado para hablar con Fritz.");
    }

    const uid = request.auth.uid;
    const db = admin.firestore();

    // 2. Get user info
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Usuario no encontrado.");
    }
    const userData = userDoc.data()!;
    const role = (userData.role as string) || "vendedor";
    const userName = (userData.displayName as string) || (userData.name as string) || "Usuario";

    // Compradores don't have Fritz access
    if (role === "comprador") {
      throw new HttpsError("permission-denied", "Fritz no está disponible para compradores.");
    }

    const { message } = request.data as FritzChatRequest;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      throw new HttpsError("invalid-argument", "El mensaje no puede estar vacío.");
    }

    // 3. Rate limit
    await checkRateLimit(db, uid);

    // 4. Load conversation history
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const conversationId = `${uid}_${today}`;
    const convRef = db.collection("fritzConversations").doc(conversationId);
    const convDoc = await convRef.get();
    const existingMessages: ConversationMessage[] = convDoc.exists
      ? (convDoc.data()?.messages || []).slice(-10)
      : [];

    // 5. Load knowledge base
    const knowledge = await loadKnowledge(db);

    // 6. Get tools for role
    const tools = getToolsForRole(role);
    const toolNames = tools.map((t) => t.name);

    // 7. Build system prompt
    const systemPrompt = buildSystemPrompt(role, toolNames, knowledge, userName);

    // 8. Build Anthropic messages
    const anthropicMessages: Anthropic.MessageParam[] = existingMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    anthropicMessages.push({ role: "user", content: message.trim() });

    // 9. Build Anthropic tools
    const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: "object" as const,
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([key, param]) => [
            key,
            {
              type: param.type,
              description: param.description,
              ...(param.enum ? { enum: param.enum } : {}),
            },
          ])
        ),
        required: Object.entries(t.parameters)
          .filter(([_, param]) => !param.optional)
          .map(([key]) => key),
      },
    }));

    // 10. Call Anthropic with tool-calling loop
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    const toolCtx: ToolContext = { uid, role, db };

    let currentMessages = [...anthropicMessages];
    let finalResponse = "";
    let actionData: FritzChatResponse["action"] = undefined;
    let toolCallsLog: ConversationMessage["toolCalls"] = [];
    const MAX_TOOL_CALLS = 3;
    let toolCallCount = 0;

    while (toolCallCount <= MAX_TOOL_CALLS) {
      const apiResponse = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: currentMessages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      });

      // Check if response has tool use
      const hasToolUse = apiResponse.content.some((block) => block.type === "tool_use");

      if (!hasToolUse) {
        // Extract text response
        finalResponse = apiResponse.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("\n");
        break;
      }

      // Process tool calls
      const assistantContent = apiResponse.content;
      currentMessages.push({ role: "assistant", content: assistantContent });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of assistantContent) {
        if (block.type !== "tool_use") continue;

        toolCallCount++;
        if (toolCallCount > MAX_TOOL_CALLS) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: "Límite de herramientas alcanzado. Respondé con lo que tenés.",
          });
          continue;
        }

        const tool = tools.find((t) => t.name === block.name);
        if (!tool) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Herramienta "${block.name}" no encontrada.`,
            is_error: true,
          });
          continue;
        }

        try {
          const result = await tool.executor(block.input as Record<string, unknown>, toolCtx);

          // Check if this is a sale preview that should trigger the modal
          const resultObj = result as Record<string, unknown>;
          if (resultObj.type === "sale_preview" && resultObj.preview) {
            actionData = { type: "sale_preview", data: resultObj.preview };
          } else if (resultObj.type === "confirmation") {
            actionData = { type: "confirmation", data: resultObj };
          }

          toolCallsLog!.push({
            name: block.name,
            input: block.input as Record<string, unknown>,
            result: resultObj,
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Error ejecutando herramienta.";
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: errorMsg,
            is_error: true,
          });
        }
      }

      currentMessages.push({ role: "user", content: toolResults });
    }

    // 11. Save conversation
    const newMessages: ConversationMessage[] = [
      ...existingMessages,
      { role: "user", content: message.trim(), timestamp: Date.now() },
      {
        role: "assistant",
        content: finalResponse,
        timestamp: Date.now(),
        ...(toolCallsLog!.length > 0 ? { toolCalls: toolCallsLog } : {}),
      },
    ];

    await convRef.set(
      {
        userId: uid,
        messages: newMessages.slice(-20), // Keep last 20 messages
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 12. Return response
    return {
      response: finalResponse,
      action: actionData,
      conversationId,
    };
  }
);
