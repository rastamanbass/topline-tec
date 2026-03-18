export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: 'admin' | 'gerente' | 'vendedor' | 'comprador' | 'taller';
  clientId?: string; // Link to Client for B2B buyers
  isActive?: boolean; // Admin can deactivate accounts
  fcmToken?: string; // Firebase Cloud Messaging token for push notifications
}

export interface Phone {
  id: string;
  imei: string; // Unique identifier
  marca: string; // Brand (Apple, Samsung, etc.)
  supplierCode?: string | null; // Proveedor de Eduardo: "WNY", "XT", etc.
  modelo: string; // Model (iPhone 15 Pro Max, etc.)
  storage?: string; // Capacity (128GB, 256GB, etc.)
  lote: string; // Lot/batch grouping
  costo: number; // Cost in USD
  precioVenta: number; // Selling price in USD
  estado: PhoneStatus; // Current status
  condition?: 'New' | 'Open Box' | 'Grade A' | 'Grade B' | 'Grade C'; // Physical condition
  clienteId?: string; // Reference to clients/{id} if sold
  fechaIngreso: Date; // Registration date
  fechaVenta?: Date; // Sale date
  reparaciones?: Repair[]; // Repair history
  statusHistory?: StatusChange[]; // Status change audit trail
  createdBy?: string; // UID of user who created
  updatedAt?: Date; // Last update timestamp
  photos?: string[]; // URLs in Storage (future)
  seized?: boolean; // true = phone confiscated (CECOT, customs, etc.)
  seizedReason?: string; // "CECOT", "Aduana", etc.
  seizedDate?: string; // ISO date when seized
  reservation?: {
    reservedBy: string; // SessionID
    orderId?: string; // Link to PendingOrder
    reservedAt: number; // Timestamp (millis)
    expiresAt: number; // Timestamp (millis)
    customerName?: string; // Optional Alias
  } | null;
}

export type PhoneStatus =
  | 'En Bodega (USA)'
  | 'En Tránsito (a El Salvador)'
  | 'En Stock (Disponible para Venta)'
  | 'Apartado'
  | 'Pagado'
  | 'Vendido (Pendiente de Entrega)'
  | 'Vendido'
  | 'Enviado a Taller (Garantía)'
  | 'Enviado a Taller (Externo)'
  | 'En Taller (Recibido)'
  | 'Enviado a Gerencia (Pendiente)'
  | 'Enviado a Gerencia'
  | 'Recibido de Taller (OK)'
  | 'Entregado al Cliente'
  | 'Reingreso (Tomado como parte de pago)'
  | 'De Baja';

export interface Repair {
  date: Date;
  note: string;
  cost: number;
  paid: boolean;
  user: string;
}

export interface StatusChange {
  newStatus: PhoneStatus;
  date: Date;
  user: string;
  details?: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string; // Company name for B2B
  creditAmount: number;
  debtAmount: number;
  isWorkshopAccount: boolean;
  userId?: string; // Link to User for B2B buyers
  isActive?: boolean; // Admin can deactivate
}

export interface Purchase {
  id: string;
  items: PurchaseItem[];
  totalAmount: number;
  paymentMethod: string;
  discountAmount: number;
  debtIncurred: number;
  amountPaidWithCredit: number;
  amountPaidWithWorkshopDebt: number;
  transferDetails?: {
    number: string;
    name: string;
    bank: string;
  };
  notes?: string;
  purchaseDate: Date;
}

export interface PurchaseItem {
  id?: string; // Optional temp ID for UI keys
  phoneId?: string;
  accessoryId?: string;
  description: string;
  price: number;
  quantity: number;
  imei?: string;
  type: 'phone' | 'accessory';
}

export type OrderStatus =
  | 'reserved' // Reserva temporal (30 min)
  | 'pending_payment' // Esperando pago (Stripe / PayPal iniciado)
  | 'pending_transfer' // Esperando confirmación de transferencia bancaria
  | 'paid' // Pagado exitosamente
  | 'payment_failed' // Pago rechazado
  | 'cancelled' // Cancelado por timeout o expiración
  | 'delivered'; // Entregado al cliente

export interface PendingOrder {
  id: string;
  sessionId: string; // From reservation system
  clientId?: string; // Link to Client (optional initially)
  clientAlias?: string; // Temporary name if no account
  clientEmail?: string;
  clientPhone?: string;

  // Items
  phoneIds: string[]; // Reserved phones
  phones: {
    // Snapshot of phones at time of order
    id: string;
    marca: string;
    modelo: string;
    precio: number;
    imei: string;
    condition: string;
  }[];

  // Financial
  subtotal: number;
  discountAmount: number;
  total: number;

  // Payment
  paymentMethod?: string; // 'stripe', 'paypal', 'transfer', 'cash', etc.
  paymentDetails?: {
    transferReference?: string;
    transferBank?: string;
  };

  // Online payment IDs (set by Cloud Functions)
  stripeSessionId?: string;
  transferRef?: string;

  // Source
  source?: 'online' | 'pos'; // How the order was created

  // Invoice
  invoiceUrl?: string; // URL to downloadable invoice (future)

  // Status
  status: OrderStatus;

  // Timestamps
  createdAt: Date;
  reservedUntil: Date; // Expiration of reservation
  paidAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;

  // Metadata
  notes?: string;
  whatsappLink?: string;

  // Shipment link
  shipmentId?: string;
}

// ── Shipments ─────────────────────────────────────────────────────────────────

export type ShipmentCarrier =
  | 'Persona'
  | 'Transnexpress'
  | 'King Express'
  | 'Cargo a Tu Puerta'
  | 'UPS'
  | 'DHL'
  | 'Otro';

export type ShipmentStatus =
  | 'preparando'
  | 'en_bodega_usa'
  | 'en_transito'
  | 'en_aduana'
  | 'en_el_salvador'
  | 'entregado';

export interface Shipment {
  id: string;
  orderId: string;
  phoneIds: string[];
  carrier: ShipmentCarrier;
  carrierCustomName?: string; // cuando carrier === 'Otro'
  courierName?: string; // cuando carrier === 'Persona'
  trackingNumber?: string; // número de guía (si aplica)
  status: ShipmentStatus;
  estimatedArrival?: string; // YYYY-MM-DD
  notes?: string;
  clientId?: string;
  clientName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  deliveredAt?: unknown;
}

// ── Invoices ───────────────────────────────────────────────────────────────────

export interface InvoiceItem {
  description: string;
  imei?: string;
  condition?: string;
  storage?: string;
  quantity: number;
  unitPrice: number;
  subtotalLine: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // "INV-2026-0001" — sequential, never repeats
  issuedAt: unknown; // serverTimestamp (Firestore Timestamp in DB)
  issuedByEmail: string;
  issuedByName?: string | null;

  company: {
    name: 'TOP LINE TEC';
    address: 'Miami, FL, USA';
    description: 'Compra-Venta de Dispositivos Móviles';
  };

  clientId?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;

  items: InvoiceItem[];

  subtotal: number;
  discountAmount: number;
  total: number;

  paymentMethod: string;
  amountPaidWithCredit?: number;
  amountPaidWithWorkshopDebt?: number;
  debtIncurred?: number;
  transferDetails?: {
    number: string;
    name: string;
    bank: string;
  };
  cashAmount?: number;

  notes?: string;

  status: 'active' | 'cancelled' | 'voided';

  phoneIds: string[];
  purchaseId?: string;
  orderId?: string;
  source: 'pos' | 'online';
}

// ── ReceptionActs ─────────────────────────────────────────────────────────────

export interface ReceptionActPhone {
  id: string;
  imei: string;
  marca: string;
  modelo: string;
  storage?: string;
  condition?: string;
}

export interface ReceptionAct {
  id: string;
  lote: string;
  reportId: string;
  receivedAt: unknown; // serverTimestamp
  receivedByEmail: string;
  responsibleName: string;
  signatureDataUrl: string;
  phones: ReceptionActPhone[];
  totalReceived: number;
  totalMissing: number;
  missingImeis: string[];
  status: 'signed' | 'unsigned';
}

// ── Supplier Invoices ─────────────────────────────────────────────────────────

export interface SupplierImportTemplate {
  fileType: 'excel' | 'pdf' | 'auto';
  hasIMEIs: boolean;
  headerRow: number;
  columnMappings: {
    imei?: string;
    make?: string;
    model?: string;
    storage?: string;
    carrier?: string;
    fullModel?: string;
    unitPrice?: string;
    qty?: string;
    boxNumber?: string;
  };
  savedAt: unknown;
}

export interface Supplier {
  id: string;
  name: string;
  code?: string; // Matches phones.marca for supplier-code phones
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  importTemplate?: SupplierImportTemplate;
  invoiceCount: number;
  totalPhonesPurchased: number;
  autoSeeded?: boolean; // true if created by auto-seed from inventory
  createdAt: unknown;
  updatedAt?: unknown;
}

export interface SupplierInvoiceItem {
  rowIndex: number;
  imei?: string;
  imeiValid?: boolean;
  make?: string;
  model?: string;
  storage?: string;
  carrier?: string;
  fullModel?: string;
  description?: string;
  unitPrice?: number;
  qty: number;
  type: 'phone' | 'accessory' | 'part' | 'unknown';
  resolvedMarca?: string;
  resolvedModelo?: string;
  supplierCode?: string | null;
}

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate?: string;
  fileName: string;
  fileType: 'excel' | 'pdf';
  totalRows: number;
  totalPhones: number;
  totalAccessories: number;
  totalParts: number;
  totalAmount?: number;
  importedPhoneIds: string[];
  importedLote: string;
  initialStatus: PhoneStatus;
  status: 'imported' | 'pending_arrival' | 'received' | 'archived';
  importedByEmail: string;
  importedByName?: string | null;
  createdAt: unknown;
}

// ── Import Shipments (USA → El Salvador) ─────────────────────────────────────

export type ImportShipmentStatus =
  | 'preparando' // Eduardo configuring the shipment (phones still in En Bodega)
  | 'en_transito' // Phones marked En Tránsito, on the way to El Salvador
  | 'recibido'; // Fully received in El Salvador

export interface ImportShipment {
  id: string;
  name: string; // "Envío Nov 2026" — free text
  lote: string; // Lote name (to match phones)
  phoneIds: string[]; // Phone document IDs included
  carrier: ShipmentCarrier;
  carrierCustomName?: string; // When carrier === 'Otro'
  courierName?: string; // When carrier === 'Persona'
  trackingNumber?: string;
  status: ImportShipmentStatus;
  estimatedArrival?: string; // YYYY-MM-DD
  notes?: string;
  createdBy: string; // User email
  createdAt: unknown;
  updatedAt?: unknown;
  receivedAt?: unknown;
  receivedBy?: string;
  receivedCount?: number;
  reportId?: string; // Link to receivingReports collection
}

// ... existing code ...

export interface CatalogItem {
  id: string; // brand-model-storage (normalized)
  brand: string;
  model: string;
  storage: string;
  averagePrice: number;
  lastUpdated: Date;
  source: 'manual' | 'auto';
}
