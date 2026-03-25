import { Timestamp } from "firebase-admin/firestore";

// === Request / Response ===

export interface FritzChatRequest {
  message: string;
  conversationId?: string;
  context?: {
    currentPage: string;
    selectedLote?: string;
    selectedPhone?: string;
  };
}

export interface FritzChatResponse {
  response: string;
  action?: {
    type: "sale_preview" | "confirmation" | "info_card" | "none";
    data: unknown;
  };
  conversationId: string;
}

// === Conversation Memory ===

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: { name: string; input: Record<string, unknown>; result: unknown }[];
}

// === Sale Preview (for FritzSaleModal) ===

export interface SalePreviewItem {
  modelo: string;
  marca: string;
  storage: string;
  lote: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
  phoneIds: string[];
  imeis: string[];
}

export interface SalePreview {
  clientId: string;
  clientName: string;
  clientCredit: number;
  clientDebt: number;
  items: SalePreviewItem[];
  grandTotal: number;
  lote: string;
  availableModels: {
    modelo: string;
    marca: string;
    storage: string;
    available: number;
    price: number;
  }[];
}

// === Knowledge Base ===

export interface KnowledgeEntry {
  trigger: string;
  resolution: string;
  type: "product_alias" | "client_alias" | "lote_alias" | "business_rule" | "faq";
  addedBy: string;
  addedAt: Timestamp;
  usageCount: number;
}

// === Tool Context (passed to every tool executor) ===

export interface ToolContext {
  uid: string;
  role: string;
  db: FirebaseFirestore.Firestore;
}

// === Tool Definition ===

export interface FritzToolDef {
  name: string;
  description: string;
  parameters: Record<
    string,
    {
      type: string;
      description: string;
      enum?: string[];
      optional?: boolean;
    }
  >;
  roles: string[];
  mutates: boolean;
  executor: (params: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}
