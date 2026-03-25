import type { FritzToolDef, ToolContext, SalePreview, SalePreviewItem } from "./types";

// ── Helper: format currency ──────────────────────────────────────────────────
const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

// ── TOOL 1: query_stock ──────────────────────────────────────────────────────
const queryStock: FritzToolDef = {
  name: "query_stock",
  description:
    "Check available phone inventory. Can filter by model, brand, storage, lote, or status. Returns count and list of matching phones.",
  parameters: {
    modelo: { type: "string", description: "Phone model name (e.g. iPhone 13, A36)", optional: true },
    marca: { type: "string", description: "Brand (e.g. Apple, Samsung)", optional: true },
    storage: { type: "string", description: "Storage capacity (e.g. 128GB)", optional: true },
    lote: { type: "string", description: "Lot/shipment name", optional: true },
    estado: {
      type: "string",
      description: 'Phone status. Default: "En Stock (Disponible para Venta)"',
      optional: true,
    },
  },
  roles: ["admin", "gerente", "vendedor"],
  mutates: false,
  executor: async (params, ctx) => {
    const estado = (params.estado as string) || "En Stock (Disponible para Venta)";
    let q: FirebaseFirestore.Query = ctx.db.collection("phones").where("estado", "==", estado);

    if (params.marca) q = q.where("marca", "==", params.marca);
    if (params.lote) q = q.where("lote", "==", params.lote);

    const snap = await q.limit(500).get();
    let phones = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];

    // Client-side filters for partial matches
    if (params.modelo) {
      const search = (params.modelo as string).toLowerCase();
      phones = phones.filter((p) => ((p.modelo as string) || "").toLowerCase().includes(search));
    }
    if (params.storage) {
      const search = (params.storage as string).toLowerCase();
      phones = phones.filter((p) => ((p.storage as string) || "").toLowerCase().includes(search));
    }

    // Group by model for summary
    const groups: Record<string, { count: number; avgPrice: number; lotes: Set<string> }> = {};
    for (const p of phones) {
      const key = `${p.marca} ${p.modelo} ${p.storage || ""}`.trim();
      if (!groups[key]) groups[key] = { count: 0, avgPrice: 0, lotes: new Set() };
      groups[key].count++;
      groups[key].avgPrice += (p.precioVenta as number) || 0;
      groups[key].lotes.add((p.lote as string) || "sin lote");
    }

    const summary = Object.entries(groups).map(([model, g]) => ({
      model,
      count: g.count,
      avgPrice: Math.round((g.avgPrice / g.count) * 100) / 100,
      lotes: [...g.lotes],
    }));

    return {
      totalCount: phones.length,
      summary,
      message:
        phones.length === 0
          ? "No encontré teléfonos con esos filtros."
          : `Encontré ${phones.length} teléfono(s).`,
    };
  },
};

// ── TOOL 2: query_stock_summary ──────────────────────────────────────────────
const queryStockSummary: FritzToolDef = {
  name: "query_stock_summary",
  description: "Get inventory totals grouped by model within a specific lote/shipment.",
  parameters: {
    lote: { type: "string", description: "Lot/shipment name to summarize" },
  },
  roles: ["admin", "gerente", "vendedor"],
  mutates: false,
  executor: async (params, ctx) => {
    const snap = await ctx.db
      .collection("phones")
      .where("lote", "==", params.lote)
      .where("estado", "==", "En Stock (Disponible para Venta)")
      .limit(500)
      .get();

    const groups: Record<string, { count: number; price: number }> = {};
    for (const doc of snap.docs) {
      const d = doc.data();
      const key = `${d.marca} ${d.modelo} ${d.storage || ""}`.trim();
      if (!groups[key]) groups[key] = { count: 0, price: 0 };
      groups[key].count++;
      groups[key].price = d.precioVenta || 0;
    }

    const models = Object.entries(groups)
      .map(([model, g]) => ({ model, available: g.count, price: g.price }))
      .sort((a, b) => b.available - a.available);

    return {
      lote: params.lote,
      totalAvailable: snap.size,
      models,
    };
  },
};

// ── TOOL 3: search_client ────────────────────────────────────────────────────
const searchClient: FritzToolDef = {
  name: "search_client",
  description: "Find a client by name, phone number, or email. Supports partial name matching.",
  parameters: {
    query: { type: "string", description: "Client name, phone, or email to search for" },
  },
  roles: ["admin", "gerente", "vendedor"],
  mutates: false,
  executor: async (params, ctx) => {
    const search = (params.query as string).toLowerCase();
    const snap = await ctx.db.collection("clients").limit(200).get();

    const matches = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c: Record<string, unknown>) => {
        const name = ((c.name as string) || "").toLowerCase();
        const phone = ((c.phone as string) || "").toLowerCase();
        const email = ((c.email as string) || "").toLowerCase();
        return name.includes(search) || phone.includes(search) || email.includes(search);
      })
      .slice(0, 10)
      .map((c: Record<string, unknown>) => ({
        id: c.id,
        name: c.name,
        phone: c.phone || null,
        email: c.email || null,
        creditAmount: c.creditAmount || 0,
        debtAmount: c.debtAmount || 0,
        company: c.company || null,
      }));

    return {
      count: matches.length,
      clients: matches,
      message:
        matches.length === 0
          ? `No encontré ningún cliente con "${params.query}".`
          : `Encontré ${matches.length} cliente(s).`,
    };
  },
};

// ── TOOL 4: query_client_debt ────────────────────────────────────────────────
const queryClientDebt: FritzToolDef = {
  name: "query_client_debt",
  description: "Check a client's debt amount and recent payment history.",
  parameters: {
    clientId: { type: "string", description: "Client document ID" },
  },
  roles: ["admin", "gerente", "vendedor"],
  mutates: false,
  executor: async (params, ctx) => {
    const clientDoc = await ctx.db.collection("clients").doc(params.clientId as string).get();
    if (!clientDoc.exists) return { error: "Cliente no encontrado." };

    const client = clientDoc.data()!;

    // Get recent payments
    const paymentsSnap = await ctx.db
      .collection("clients")
      .doc(params.clientId as string)
      .collection("debtPayments")
      .orderBy("paidAt", "desc")
      .limit(5)
      .get();

    const recentPayments = paymentsSnap.docs.map((d) => {
      const data = d.data();
      return {
        amount: data.amount,
        date: data.paidAt?.toDate?.()?.toISOString?.()?.slice(0, 10) || "N/A",
        method: data.paymentMethod || "N/A",
      };
    });

    return {
      clientName: client.name,
      debtAmount: client.debtAmount || 0,
      creditAmount: client.creditAmount || 0,
      recentPayments,
      message:
        (client.debtAmount || 0) > 0
          ? `${client.name} debe ${fmt(client.debtAmount)}. Último pago: ${recentPayments[0]?.date || "nunca"}.`
          : `${client.name} no tiene deuda pendiente.`,
    };
  },
};

// ── TOOL 5: query_sales_today ────────────────────────────────────────────────
const querySalesToday: FritzToolDef = {
  name: "query_sales_today",
  description: "Get today's sales count and total revenue.",
  parameters: {},
  roles: ["admin", "gerente"],
  mutates: false,
  executor: async (_params, ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    const snap = await ctx.db
      .collection("phones")
      .where("estado", "==", "Vendido")
      .where("fechaVenta", "==", today)
      .limit(500)
      .get();

    let totalRevenue = 0;
    const models: Record<string, number> = {};
    for (const doc of snap.docs) {
      const d = doc.data();
      totalRevenue += d.precioVenta || 0;
      const key = `${d.marca} ${d.modelo}`;
      models[key] = (models[key] || 0) + 1;
    }

    const topModels = Object.entries(models)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([model, count]) => ({ model, count }));

    return {
      date: today,
      totalSold: snap.size,
      totalRevenue,
      topModels,
    };
  },
};

// ── TOOL 6: query_sales_period ───────────────────────────────────────────────
const querySalesPeriod: FritzToolDef = {
  name: "query_sales_period",
  description: "Get sales for a specific date range.",
  parameters: {
    startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
    endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
  },
  roles: ["admin", "gerente"],
  mutates: false,
  executor: async (params, ctx) => {
    const snap = await ctx.db
      .collection("phones")
      .where("estado", "==", "Vendido")
      .where("fechaVenta", ">=", params.startDate)
      .where("fechaVenta", "<=", params.endDate)
      .limit(1000)
      .get();

    let totalRevenue = 0;
    for (const doc of snap.docs) {
      totalRevenue += doc.data().precioVenta || 0;
    }

    return {
      period: `${params.startDate} - ${params.endDate}`,
      totalSold: snap.size,
      totalRevenue,
    };
  },
};

// ── TOOL 7: get_notifications ────────────────────────────────────────────────
const getNotifications: FritzToolDef = {
  name: "get_notifications",
  description:
    "Get pending alerts: phones stuck in workshop, overdue client debts, stale inventory.",
  parameters: {},
  roles: ["admin", "gerente"],
  mutates: false,
  executor: async (_params, ctx) => {
    const alerts: { type: string; severity: string; message: string }[] = [];

    // Phones stuck in taller > 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const tallerSnap = await ctx.db
      .collection("phones")
      .where("estado", "==", "En Taller (Recibido)")
      .limit(100)
      .get();

    const stuckInTaller = tallerSnap.docs.filter((d) => {
      const history = d.data().statusHistory as { date: { toDate?: () => Date } }[] | undefined;
      if (!history || history.length === 0) return true;
      const lastChange = history[history.length - 1];
      const date = lastChange.date?.toDate?.() || new Date();
      return date < fourteenDaysAgo;
    });

    if (stuckInTaller.length > 0) {
      alerts.push({
        type: "stuck_workshop",
        severity: "high",
        message: `${stuckInTaller.length} teléfono(s) llevan más de 14 días en taller.`,
      });
    }

    // Clients with overdue debt
    const clientsSnap = await ctx.db
      .collection("clients")
      .where("debtAmount", ">", 0)
      .limit(50)
      .get();

    if (clientsSnap.size > 0) {
      const totalDebt = clientsSnap.docs.reduce((sum, d) => sum + (d.data().debtAmount || 0), 0);
      alerts.push({
        type: "overdue_debt",
        severity: "medium",
        message: `${clientsSnap.size} cliente(s) con deuda pendiente. Total: ${fmt(totalDebt)}.`,
      });
    }

    return {
      count: alerts.length,
      alerts,
    };
  },
};

// ── TOOL 8: prepare_bulk_sale ────────────────────────────────────────────────
const prepareBulkSale: FritzToolDef = {
  name: "prepare_bulk_sale",
  description:
    "Prepare a bulk sale preview. Finds available phones by model and lote, resolves client, and returns data for the pre-purchase modal. Does NOT execute the sale.",
  parameters: {
    modelo: { type: "string", description: "Phone model name (e.g. iPhone 13)" },
    marca: { type: "string", description: "Brand (e.g. Apple, Samsung)", optional: true },
    storage: { type: "string", description: "Storage capacity", optional: true },
    lote: { type: "string", description: "Lot/shipment name" },
    quantity: { type: "string", description: "Number of phones to sell" },
    pricePerUnit: { type: "string", description: "Price per unit in USD" },
    clientName: { type: "string", description: "Client name to sell to" },
  },
  roles: ["admin", "gerente", "vendedor"],
  mutates: false,
  executor: async (params, ctx) => {
    const quantity = parseInt(params.quantity as string, 10);
    if (isNaN(quantity) || quantity < 1) return { error: "Cantidad inválida." };

    const price = parseFloat(params.pricePerUnit as string);
    if (isNaN(price) || price <= 0) return { error: "Precio inválido." };

    // Find matching phones
    let phoneQuery: FirebaseFirestore.Query = ctx.db
      .collection("phones")
      .where("estado", "==", "En Stock (Disponible para Venta)")
      .where("lote", "==", params.lote)
      .limit(500);

    if (params.marca) phoneQuery = phoneQuery.where("marca", "==", params.marca);

    const phoneSnap = await phoneQuery.get();
    let phones = phoneSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];

    // Filter by model (client-side for partial match)
    const modelSearch = (params.modelo as string).toLowerCase();
    phones = phones.filter((p) => ((p.modelo as string) || "").toLowerCase().includes(modelSearch));

    if (phones.length === 0) {
      return { error: `No encontré "${params.modelo}" disponible en el lote "${params.lote}".` };
    }

    if (phones.length < quantity) {
      return {
        error: `Solo hay ${phones.length} unidades de "${params.modelo}" en "${params.lote}", pero pediste ${quantity}.`,
      };
    }

    // Take first N phones
    const selectedPhones = phones.slice(0, quantity);
    const firstPhone = selectedPhones[0];

    // Resolve client
    const clientSearch = (params.clientName as string).toLowerCase();
    const clientsSnap = await ctx.db.collection("clients").limit(200).get();
    const clientMatch = clientsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .find((c: Record<string, unknown>) =>
        ((c.name as string) || "").toLowerCase().includes(clientSearch)
      ) as Record<string, unknown> | undefined;

    if (!clientMatch) {
      return { error: `No encontré un cliente con el nombre "${params.clientName}".` };
    }

    // Build available models in same lote (for "add more" section)
    const allInLote = phoneSnap.docs.map((d) => d.data());
    const modelGroups: Record<string, { count: number; price: number; marca: string; storage: string }> = {};
    for (const p of allInLote) {
      const key = `${p.marca}|${p.modelo}|${p.storage || ""}`;
      if (!modelGroups[key]) {
        modelGroups[key] = { count: 0, price: p.precioVenta || 0, marca: p.marca, storage: p.storage || "" };
      }
      modelGroups[key].count++;
    }

    const availableModels = Object.entries(modelGroups).map(([key, g]) => {
      const [marca, modelo, storage] = key.split("|");
      return { marca, modelo, storage, available: g.count, price: g.price };
    });

    const salePreview: SalePreview = {
      clientId: clientMatch.id as string,
      clientName: clientMatch.name as string,
      clientCredit: (clientMatch.creditAmount as number) || 0,
      clientDebt: (clientMatch.debtAmount as number) || 0,
      items: [
        {
          modelo: firstPhone.modelo as string,
          marca: firstPhone.marca as string,
          storage: (firstPhone.storage as string) || "",
          lote: firstPhone.lote as string,
          quantity,
          pricePerUnit: price,
          total: price * quantity,
          phoneIds: selectedPhones.map((p) => p.id as string),
          imeis: selectedPhones.map((p) => p.imei as string),
        },
      ],
      grandTotal: price * quantity,
      lote: params.lote as string,
      availableModels,
    };

    return {
      type: "sale_preview",
      preview: salePreview,
      message: `¡Sale! Ya tengo ${quantity} ${firstPhone.marca} ${firstPhone.modelo} listos a ${fmt(price)} cada uno para ${clientMatch.name}. Son ${fmt(price * quantity)} en total. ¿Le doy?`,
    };
  },
};

// ── TOOL 9: execute_sale ─────────────────────────────────────────────────────
const executeSale: FritzToolDef = {
  name: "execute_sale",
  description:
    "Execute a confirmed sale. Updates phone statuses to 'Vendido', creates purchase record, and updates client debt if paying on credit. Requires prior confirmation from the user.",
  parameters: {
    phoneIds: { type: "string", description: "Comma-separated list of phone document IDs to sell" },
    clientId: { type: "string", description: "Client document ID" },
    pricePerUnit: { type: "string", description: "Price per unit in USD" },
    paymentMethod: {
      type: "string",
      description: "Payment method",
      enum: ["Efectivo", "Tarjeta", "Transferencia", "Credito"],
    },
  },
  roles: ["admin", "gerente", "vendedor"],
  mutates: true,
  executor: async (params, ctx) => {
    const phoneIds = (params.phoneIds as string).split(",").map((id) => id.trim());
    const price = parseFloat(params.pricePerUnit as string);
    const clientId = params.clientId as string;
    const paymentMethod = params.paymentMethod as string;

    if (phoneIds.length === 0) return { error: "No se proporcionaron teléfonos." };

    const admin = await import("firebase-admin");
    const { FieldValue, Timestamp } = admin.firestore;
    const now = Timestamp.now();
    const todayISO = new Date().toISOString().slice(0, 10);

    // Get client info
    const clientDoc = await ctx.db.collection("clients").doc(clientId).get();
    if (!clientDoc.exists) return { error: "Cliente no encontrado." };
    const clientData = clientDoc.data()!;

    const totalAmount = price * phoneIds.length;
    const isCredit = paymentMethod === "Credito";

    // Atomic batch write
    const batch = ctx.db.batch();

    // Update each phone
    for (const phoneId of phoneIds) {
      const phoneRef = ctx.db.collection("phones").doc(phoneId);
      batch.update(phoneRef, {
        estado: "Vendido",
        clienteId: clientId,
        precioVenta: price,
        fechaVenta: todayISO,
        reservation: null,
        updatedAt: now,
        statusHistory: FieldValue.arrayUnion({
          newStatus: "Vendido",
          date: now.toDate(),
          user: `fritz-${ctx.uid}`,
          details: `Vendido a ${clientData.name} vía Fritz`,
        }),
      });
    }

    // Create purchase record
    const purchaseRef = ctx.db.collection("clients").doc(clientId).collection("purchases").doc();
    batch.set(purchaseRef, {
      items: phoneIds.map((phoneId) => ({
        phoneId,
        description: "Sold via Fritz",
        price,
        quantity: 1,
        type: "phone",
      })),
      totalAmount,
      paymentMethod,
      discountAmount: 0,
      debtIncurred: isCredit ? totalAmount : 0,
      amountPaidWithCredit: 0,
      amountPaidWithWorkshopDebt: 0,
      purchaseDate: now,
      source: "fritz",
    });

    // Update client debt if credit
    if (isCredit) {
      batch.update(ctx.db.collection("clients").doc(clientId), {
        debtAmount: FieldValue.increment(totalAmount),
      });
    }

    await batch.commit();

    return {
      type: "confirmation",
      success: true,
      phonesSold: phoneIds.length,
      totalAmount,
      clientName: clientData.name,
      paymentMethod,
      purchaseId: purchaseRef.id,
      message: `${phoneIds.length} teléfono(s) vendidos a ${clientData.name} por ${fmt(totalAmount)} (${paymentMethod}).`,
    };
  },
};

// ── TOOL 10: generate_invoice ────────────────────────────────────────────────
const generateInvoice: FritzToolDef = {
  name: "generate_invoice",
  description: "Generate an invoice for a completed sale.",
  parameters: {
    clientId: { type: "string", description: "Client document ID" },
    phoneIds: { type: "string", description: "Comma-separated phone IDs that were sold" },
    totalAmount: { type: "string", description: "Total amount of the sale" },
    paymentMethod: { type: "string", description: "Payment method used" },
  },
  roles: ["admin", "gerente", "vendedor"],
  mutates: true,
  executor: async (params, ctx) => {
    const phoneIds = (params.phoneIds as string).split(",").map((id) => id.trim());
    const totalAmount = parseFloat(params.totalAmount as string);
    const clientId = params.clientId as string;

    const admin = await import("firebase-admin");
    const { Timestamp } = admin.firestore;

    // Get client
    const clientDoc = await ctx.db.collection("clients").doc(clientId).get();
    const clientData = clientDoc.data();

    // Get phone details
    const phoneDetails = [];
    for (const phoneId of phoneIds) {
      const phoneDoc = await ctx.db.collection("phones").doc(phoneId).get();
      if (phoneDoc.exists) {
        const pd = phoneDoc.data()!;
        phoneDetails.push({
          description: `${pd.marca} ${pd.modelo}`,
          imei: pd.imei,
          storage: pd.storage,
          condition: pd.condition,
          quantity: 1,
          unitPrice: pd.precioVenta || 0,
          subtotalLine: pd.precioVenta || 0,
        });
      }
    }

    // Get next invoice number
    const counterRef = ctx.db.doc("settings/invoiceCounter");
    const year = new Date().getFullYear();
    let invoiceNumber = "";

    await ctx.db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const data = snap.data();
      let nextNumber = 1;
      if (snap.exists && data?.year === year) {
        nextNumber = ((data.lastNumber as number) || 0) + 1;
      }
      tx.set(counterRef, { lastNumber: nextNumber, year });
      invoiceNumber = `INV-${year}-${String(nextNumber).padStart(4, "0")}`;
    });

    // Create invoice
    const invoiceRef = ctx.db.collection("invoices").doc();
    await invoiceRef.set({
      id: invoiceRef.id,
      invoiceNumber,
      issuedAt: Timestamp.now(),
      issuedByEmail: `fritz-${ctx.uid}`,
      clientId,
      clientName: clientData?.name || "Cliente",
      clientPhone: clientData?.phone || null,
      clientEmail: clientData?.email || null,
      company: {
        name: "TOP LINE TEC",
        address: "Miami, FL, USA",
        description: "Compra-Venta de Dispositivos Móviles",
      },
      items: phoneDetails,
      subtotal: totalAmount,
      discountAmount: 0,
      total: totalAmount,
      paymentMethod: params.paymentMethod,
      status: "active",
      phoneIds,
      source: "pos",
    });

    return {
      type: "confirmation",
      success: true,
      invoiceNumber,
      invoiceId: invoiceRef.id,
      message: `Factura ${invoiceNumber} generada para ${clientData?.name || "el cliente"}.`,
    };
  },
};

// ── Export helpers ────────────────────────────────────────────────────────────

const ALL_TOOLS: FritzToolDef[] = [
  queryStock,
  queryStockSummary,
  searchClient,
  queryClientDebt,
  querySalesToday,
  querySalesPeriod,
  getNotifications,
  prepareBulkSale,
  executeSale,
  generateInvoice,
];

export function getAllTools(): FritzToolDef[] {
  return ALL_TOOLS;
}

export function getToolsForRole(role: string): FritzToolDef[] {
  return ALL_TOOLS.filter((t) => t.roles.includes(role));
}
