# Fritz AI Assistant — Design Spec

## Overview

Fritz is an AI assistant embedded in Top Line Tec that can execute any system operation via natural language. Users talk to Fritz like an employee — "vendé 5 iPhone 13 a Juan a $330 del envío de marzo" — and Fritz prepares the action, shows a confirmation, and executes on approval.

## Architecture

**Brain:** Firebase Cloud Function calling Claude Haiku via Anthropic API with tool-calling pattern. Each system operation is a predefined tool with input validation, role-based access control, and audit logging.

**UI:** Floating bubble (bottom-right corner) opens a chat panel. For sales operations, Fritz opens an interactive pre-purchase modal where users can add/remove items from the same lote before confirming.

**Learning:** Per-user conversation memory (patterns, preferences) + shared knowledge base (store jargon, client aliases, product nicknames).

**Notifications:** V1 = badge count on bubble. V2 = Firebase Cloud Messaging push notifications for critical alerts.

---

## User Interaction Model

### Confirmation Rules
- **Direct response (no confirmation):** Read-only queries — stock counts, debt lookups, sales reports, phone status checks
- **Confirmation required (modal/card):** Any operation that modifies data — sales, status changes, client creation, debt payments, price adjustments

### Sale Flow (Primary Use Case)
1. User writes: "vende 5 iphone 13 a juan perez a 330 del envio de marzo"
2. Fritz resolves: model → iPhone 13 128gb, client → Juan Pérez, lote → ENVIO 2 MARZO AMERIJET
3. Fritz opens **Pre-Purchase Modal** with:
   - Client info (name, credit, debt)
   - Items list with +/- quantity controls per group
   - "Add more phones" section (search within same lote only)
   - Inline Fritz input for adding by natural language ("agregá 3 A36 a 220")
   - Quick suggestions from the same lote
   - Real-time total calculation
   - Payment method selector
   - Editable price per unit
4. User reviews, optionally adds more items, selects payment method
5. User taps "Confirmar Venta"
6. Fritz executes atomic sale transaction, generates invoice
7. Fritz shows confirmation with quick actions (ver factura, imprimir stickers, otra venta)

### Pre-Purchase Modal Constraints
- **Same lote only** — all phones in a single sale must come from the same lote
- **Quantity limited** to available stock per model
- **Price editable** per item group with original price shown if changed
- **Client changeable** before confirmation

---

## Personality

Fritz speaks like a friendly Salvadoran employee — casual but reliable. Examples:

- "¡Sale! Ya tengo 5 iPhone 13 listos a $330 cada uno para Juan. Son $1,650 en total. ¿Le doy?"
- "Mirá, Juan Pérez debe $2,000 desde hace 15 días. ¿Querés que le registre un pago?"
- "Del Envío 2 Marzo te quedan 23 iPhone 13 y 7 iPhone 14 Plus. ¿Vendemos?"

Fritz never uses emojis excessively, keeps responses short, and always leads with the answer.

---

## Role-Based Access

| Role | Tools Available |
|------|----------------|
| admin | All tools — sales, inventory, clients, finance, users, workshop, reports, settings |
| gerente | All except user management settings |
| vendedor | Stock queries, sales, client queries, cotizador |
| taller | Workshop queries, repair status updates |
| comprador | No Fritz access (uses B2B portal) |

---

## Tool-Calling Architecture

### Cloud Function: `fritzChat` (onCall)

**Input:**
```typescript
{
  message: string          // User's natural language message
  conversationId: string   // For memory/context
  context?: {              // Current UI state (optional)
    currentPage: string
    selectedLote?: string
    selectedPhone?: string
  }
}
```

**Processing:**
1. Authenticate user, get role
2. Load conversation history (last 10 messages)
3. Load user memory (frequent patterns)
4. Load shared knowledge base
5. Build system prompt with available tools (filtered by role)
6. Call Claude Haiku with tool-calling
7. If tool called → validate inputs → execute → return result
8. If no tool → return text response
9. Save conversation to memory
10. Return response to client

**Output:**
```typescript
{
  response: string          // Fritz's text response
  action?: {
    type: 'sale_preview' | 'confirmation' | 'info_card' | 'none'
    data: any               // Modal data, card data, etc.
  }
  notifications?: {         // New alerts to show
    count: number
    items: NotificationItem[]
  }
}
```

### Tool Definition Pattern
```typescript
{
  name: "query_stock",
  description: "Check available phone inventory by model, brand, storage, or lote",
  parameters: {
    modelo: { type: "string", optional: true },
    marca: { type: "string", optional: true },
    storage: { type: "string", optional: true },
    lote: { type: "string", optional: true },
    estado: { type: "string", optional: true, default: "En Stock (Disponible para Venta)" }
  },
  roles: ["admin", "gerente", "vendedor"],
  mutates: false
}
```

### Phase 1 Tools (MVP)

| Tool | Description | Mutates | Roles |
|------|-------------|---------|-------|
| `query_stock` | Check inventory by model/brand/lote/status | No | admin, gerente, vendedor |
| `query_stock_summary` | Get totals by model group within a lote | No | admin, gerente, vendedor |
| `search_client` | Find client by name/phone/email | No | admin, gerente, vendedor |
| `query_client_debt` | Check client debt amount and history | No | admin, gerente, vendedor |
| `query_sales_today` | Get today's sales count and revenue | No | admin, gerente |
| `query_sales_period` | Get sales for a date range | No | admin, gerente |
| `prepare_bulk_sale` | Prepare a bulk sale (returns items for modal) | No | admin, gerente, vendedor |
| `execute_sale` | Execute confirmed sale transaction | Yes | admin, gerente, vendedor |
| `generate_invoice` | Generate invoice for completed sale | Yes | admin, gerente, vendedor |
| `get_notifications` | Get pending alerts (stuck repairs, overdue debts, etc.) | No | admin, gerente |

### Phase 2 Tools

| Tool | Description | Mutates | Roles |
|------|-------------|---------|-------|
| `create_client` | Create new client record | Yes | admin, gerente, vendedor |
| `update_phone_status` | Change phone estado with reason | Yes | admin, gerente |
| `record_debt_payment` | Record a client debt payment | Yes | admin, gerente |
| `send_to_workshop` | Send phone to taller with repair note | Yes | admin, gerente, taller |
| `update_repair_status` | Update workshop repair status | Yes | admin, gerente, taller |
| `generate_report` | Generate P&L, inventory, or sales report | No | admin, gerente |
| `query_workshop` | Check phones in workshop, repair status | No | admin, gerente, taller |

### Phase 3 Tools

| Tool | Description | Mutates | Roles |
|------|-------------|---------|-------|
| `create_import_shipment` | Create USA→SV shipment | Yes | admin, gerente |
| `mark_shipment_received` | Mark shipment as received | Yes | admin, gerente |
| `manage_accessories` | CRUD accessories inventory | Yes | admin, gerente |
| `create_user` | Create new system user | Yes | admin |
| `build_quote` | Build a custom quote/cotización | Yes | admin, gerente, vendedor |
| `update_prices` | Bulk update precioVenta for a model group | Yes | admin, gerente |

---

## Learning System

### Per-User Memory
Stored in: `fritzMemory/{userId}/conversations` (Firestore subcollection)

- Last 50 conversations (rolling window)
- Extracted patterns: frequent clients, preferred prices, common queries
- Fritz uses these to suggest and auto-complete

### Shared Knowledge Base
Stored in: `fritzKnowledge/{entryId}` (Firestore collection)

Entries like:
```json
{
  "trigger": "los chinos",
  "resolution": "Samsung A36 5G",
  "type": "product_alias",
  "addedBy": "admin",
  "addedAt": "2026-03-22"
}
```

Types:
- `product_alias` — nicknames for phones ("los chinos" → Samsung A36)
- `client_alias` — short names for clients ("Juan" → Juan Pérez, client #47)
- `lote_alias` — shorthand for lotes ("el de Carlos" → "envio 6 agosto carlos v")
- `business_rule` — operational rules ("iPhone 13 never sells below $300")
- `faq` — common questions and answers

Admin can manage via Fritz: "Fritz, cuando diga 'los chinos' me refiero a los Samsung A36"

V2: Fritz suggests entries automatically: "Eduardo siempre dice 'los chinos' para Samsung A36. ¿Lo guardo como alias?"

---

## Notification System

### V1: In-App Badge
- Fritz bubble shows red badge with count
- Opening Fritz shows notification list at top
- Notifications generated by scheduled Cloud Function (every 30 min) or triggered by events

### Alert Types
| Alert | Trigger | Severity |
|-------|---------|----------|
| Phones stuck in taller | phone in taller estado > 14 days | High |
| Client overdue debt | client.debtAmount > 0, last payment > 30 days | Medium |
| Low accessory stock | accessory.stock < accessory.minStock | Medium |
| Shipment overdue | importShipment.estimatedArrival < today, status != recibido | High |
| Stale inventory | phone in stock > 30 days | Low |
| Daily sales summary | End of business day (6 PM) | Info |

### V2: Push Notifications (Firebase Cloud Messaging)
- Service Worker registration on first Fritz open
- Permission request with clear explanation
- Push only for High severity alerts
- Tap notification → opens Fritz with alert context

---

## UI Components

### 1. FritzBubble
- Fixed position bottom-right (above mobile nav)
- 56px circle with gradient (blue→purple)
- Red badge for notification count
- Tap → opens FritzPanel
- Draggable (optional, V2)

### 2. FritzPanel
- Slides up from bubble (mobile) or expands as overlay (desktop)
- Max height: 70vh
- Header: Fritz avatar + name + online status + close button
- Body: scrollable conversation messages
- Input: text field + send button
- Messages: user (right, purple) + Fritz (left, dark)
- Action cards: inline within conversation (info cards, quick actions)

### 3. FritzSaleModal (Pre-Purchase)
- Full modal overlay (like existing BulkSaleDialog pattern)
- Header: green gradient, "Fritz — Pre-Compra"
- Client section: name, credit, debt, change button
- Items list: grouped by model, +/- quantity, editable price, delete
- "Add more" section: search within same lote + Fritz inline input + quick suggestions
- Totals: itemized + grand total, real-time updates
- Payment selector: Efectivo, Tarjeta, Transferencia, Crédito
- Actions: Cancel + Confirmar Venta (shows total)

### 4. FritzNotifications
- Shown at top of FritzPanel when opened
- Dismissable cards with action buttons
- "3 phones stuck in taller" → button "Ver detalles"

---

## Data Model

### Firestore Collections

```
/fritzConversations/{conversationId}
  userId: string
  messages: Message[]  // {role, content, timestamp, toolCalls?}
  createdAt: Timestamp
  updatedAt: Timestamp

/fritzMemory/{userId}
  frequentClients: string[]      // Top 5 client IDs
  frequentModels: string[]       // Top 5 model names
  pricePreferences: {model: price}[]
  lastUpdated: Timestamp

/fritzKnowledge/{entryId}
  trigger: string
  resolution: string
  type: 'product_alias' | 'client_alias' | 'lote_alias' | 'business_rule' | 'faq'
  addedBy: string
  addedAt: Timestamp
  usageCount: number

/fritzNotifications/{notificationId}
  userId: string
  type: string
  message: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  read: boolean
  actionUrl?: string
  createdAt: Timestamp
```

---

## Cloud Functions

### New Functions for Fritz

1. **`fritzChat`** (onCall) — Main chat endpoint. Authenticates, loads context, calls Claude Haiku with tools, returns response.

2. **`fritzGenerateNotifications`** (onSchedule, every 30 min) — Scans for alert conditions (stuck repairs, overdue debts, etc.), creates notification documents.

3. **`fritzManageKnowledge`** (onCall) — CRUD for knowledge base entries. Admin only.

### Anthropic API
- Model: `claude-haiku-4-5-20251001` (fast, cheap, ~$0.001/message)
- Upgrade path: `claude-sonnet-4-6` for complex operations if needed
- API Key: stored as Firebase secret (`ANTHROPIC_API_KEY`)
- Max tokens per response: 1024
- System prompt: ~2000 tokens (tools + personality + context)

### Cost Estimate
- 200 messages/day × $0.001 = $0.20/day = **~$6/month**
- With Sonnet fallback (10% of messages): ~$10/month
- Firebase Cloud Functions: within free tier for this volume

---

## Security

1. **Authentication required** — Fritz only responds to authenticated users
2. **Role-based tool filtering** — vendedor can't access admin tools
3. **Confirmation for mutations** — all data-modifying operations require explicit user confirmation
4. **Audit trail** — every Fritz action logged with userId, tool, params, result, timestamp
5. **Rate limiting** — 30 messages/minute per user (prevent abuse)
6. **No raw Firestore access** — Fritz uses predefined tools only, never generates queries
7. **API key isolation** — Anthropic key stored as Firebase secret, never exposed to client

---

## Implementation Phases

### Phase 1: MVP (~2 weeks)
- Cloud Function `fritzChat` with Haiku
- 10 read-only + sale tools
- FritzBubble + FritzPanel components
- FritzSaleModal (pre-purchase with add-more)
- Knowledge base (manual entries)
- In-app notification badge
- Basic conversation memory (last 10 messages)

### Phase 2: Extended Operations (~2 weeks)
- 7 additional mutation tools (clients, workshop, reports)
- Per-user memory with pattern extraction
- Auto-suggest knowledge entries
- Push notifications (FCM)
- Report generation tools

### Phase 3: Full Power (~2 weeks)
- 6 additional tools (shipments, accessories, users, quotes)
- Fritz admin panel (view conversations, manage knowledge, usage stats)
- Sonnet fallback for complex queries
- Voice input (Web Speech API)
- Multi-step operations (Fritz remembers context across messages)

---

## Success Criteria

1. Eduardo can sell 30 phones in under 2 minutes using Fritz (vs 15+ min manually)
2. Marta can check any client's debt in one message
3. Fritz understands "los chinos", "el envío de Carlos", typos, and Salvadoran slang
4. Zero accidental sales — confirmation modal prevents every mistake
5. Fritz responds in <5 seconds for queries, <10 seconds for operations
6. 95%+ intent recognition accuracy on common operations
