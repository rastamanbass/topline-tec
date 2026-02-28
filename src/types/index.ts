export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: 'admin' | 'gerente' | 'vendedor' | 'comprador' | 'taller';
  clientId?: string; // Link to Client for B2B buyers
  isActive?: boolean; // Admin can deactivate accounts
}

export interface Phone {
  id: string;
  imei: string; // Unique identifier
  marca: string; // Brand (Apple, Samsung, etc.)
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
  | 'pending_payment' // Esperando pago
  | 'paid' // Pagado exitosamente
  | 'payment_failed' // Pago rechazado
  | 'cancelled' // Cancelado por timeout
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
  paymentMethod?: string; // 'paypal', 'transfer', 'cash', etc.
  paymentDetails?: {
    paypalOrderId?: string;
    paypalPayerId?: string;
    paypalPaymentId?: string;
    transferReference?: string;
    transferBank?: string;
  };

  // Status
  status: OrderStatus;

  // Timestamps
  createdAt: Date;
  reservedUntil: Date; // Expiration of reservation
  paidAt?: Date;
  deliveredAt?: Date;

  // Metadata
  notes?: string;
  whatsappLink?: string;
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
