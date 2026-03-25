"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fritzChat = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const systemPrompt_1 = require("./systemPrompt");
const tools_1 = require("./tools");
const ANTHROPIC_API_KEY = (0, params_1.defineSecret)("ANTHROPIC_API_KEY");
// ── Knowledge cache (5 min TTL) ──────────────────────────────────────────────
let knowledgeCache = [];
let knowledgeCacheTime = 0;
const KNOWLEDGE_CACHE_TTL = 5 * 60 * 1000;
async function loadKnowledge(db) {
    if (Date.now() - knowledgeCacheTime < KNOWLEDGE_CACHE_TTL && knowledgeCache.length > 0) {
        return knowledgeCache;
    }
    const snap = await db.collection("fritzKnowledge").limit(100).get();
    knowledgeCache = snap.docs.map((d) => d.data());
    knowledgeCacheTime = Date.now();
    return knowledgeCache;
}
// ── Rate limiting ────────────────────────────────────────────────────────────
async function checkRateLimit(db, uid) {
    const ref = db.collection("fritzRateLimit").doc(uid);
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const doc = await ref.get();
    const data = doc.data();
    const timestamps = ((data === null || data === void 0 ? void 0 : data.timestamps) || []).filter((t) => t > oneMinuteAgo);
    if (timestamps.length >= 30) {
        throw new https_1.HttpsError("resource-exhausted", "Brother, más despacio — máximo 30 mensajes por minuto.");
    }
    timestamps.push(now);
    await ref.set({ timestamps }, { merge: true });
}
// ── Main Cloud Function ──────────────────────────────────────────────────────
exports.fritzChat = (0, https_1.onCall)({
    secrets: [ANTHROPIC_API_KEY],
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: "512MiB",
}, async (request) => {
    var _a;
    // 1. Auth check
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Necesitás estar autenticado para hablar con Fritz.");
    }
    const uid = request.auth.uid;
    const db = admin.firestore();
    // 2. Get user info
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError("not-found", "Usuario no encontrado.");
    }
    const userData = userDoc.data();
    const role = userData.role || "vendedor";
    const userName = userData.displayName || userData.name || "Usuario";
    // Compradores don't have Fritz access
    if (role === "comprador") {
        throw new https_1.HttpsError("permission-denied", "Fritz no está disponible para compradores.");
    }
    const { message } = request.data;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
        throw new https_1.HttpsError("invalid-argument", "El mensaje no puede estar vacío.");
    }
    // 3. Rate limit
    await checkRateLimit(db, uid);
    // 4. Load conversation history
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const conversationId = `${uid}_${today}`;
    const convRef = db.collection("fritzConversations").doc(conversationId);
    const convDoc = await convRef.get();
    const existingMessages = convDoc.exists
        ? (((_a = convDoc.data()) === null || _a === void 0 ? void 0 : _a.messages) || []).slice(-10)
        : [];
    // 5. Load knowledge base
    const knowledge = await loadKnowledge(db);
    // 6. Get tools for role
    const tools = (0, tools_1.getToolsForRole)(role);
    const toolNames = tools.map((t) => t.name);
    // 7. Build system prompt
    const systemPrompt = (0, systemPrompt_1.buildSystemPrompt)(role, toolNames, knowledge, userName);
    // 8. Build Anthropic messages
    const anthropicMessages = existingMessages.map((m) => ({
        role: m.role,
        content: m.content,
    }));
    anthropicMessages.push({ role: "user", content: message.trim() });
    // 9. Build Anthropic tools
    const anthropicTools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: {
            type: "object",
            properties: Object.fromEntries(Object.entries(t.parameters).map(([key, param]) => [
                key,
                Object.assign({ type: param.type, description: param.description }, (param.enum ? { enum: param.enum } : {})),
            ])),
            required: Object.entries(t.parameters)
                .filter(([_, param]) => !param.optional)
                .map(([key]) => key),
        },
    }));
    // 10. Call Anthropic with tool-calling loop
    const client = new sdk_1.default({ apiKey: ANTHROPIC_API_KEY.value() });
    const toolCtx = { uid, role, db };
    let currentMessages = [...anthropicMessages];
    let finalResponse = "";
    let actionData = undefined;
    let toolCallsLog = [];
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
                .filter((block) => block.type === "text")
                .map((block) => block.text)
                .join("\n");
            break;
        }
        // Process tool calls
        const assistantContent = apiResponse.content;
        currentMessages.push({ role: "assistant", content: assistantContent });
        const toolResults = [];
        for (const block of assistantContent) {
            if (block.type !== "tool_use")
                continue;
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
                const result = await tool.executor(block.input, toolCtx);
                // Check if this is a sale preview that should trigger the modal
                const resultObj = result;
                if (resultObj.type === "sale_preview" && resultObj.preview) {
                    actionData = { type: "sale_preview", data: resultObj.preview };
                }
                else if (resultObj.type === "confirmation") {
                    actionData = { type: "confirmation", data: resultObj };
                }
                toolCallsLog.push({
                    name: block.name,
                    input: block.input,
                    result: resultObj,
                });
                toolResults.push({
                    type: "tool_result",
                    tool_use_id: block.id,
                    content: JSON.stringify(result),
                });
            }
            catch (err) {
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
    const newMessages = [
        ...existingMessages,
        { role: "user", content: message.trim(), timestamp: Date.now() },
        Object.assign({ role: "assistant", content: finalResponse, timestamp: Date.now() }, (toolCallsLog.length > 0 ? { toolCalls: toolCallsLog } : {})),
    ];
    await convRef.set({
        userId: uid,
        messages: newMessages.slice(-20), // Keep last 20 messages
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    // 12. Return response
    return {
        response: finalResponse,
        action: actionData,
        conversationId,
    };
});
//# sourceMappingURL=fritzChat.js.map