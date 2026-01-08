export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: 'admin' | 'gerente' | 'vendedor' | 'comprador';
}

export interface Phone {
  id: string;
  imei: string; // Unique identifier
  marca: string; // Brand (Apple, Samsung, etc.)
  modelo: string; // Model (iPhone 15 Pro Max, etc.)
  lote: string; // Lot/batch grouping
  costo: number; // Cost in USD
  precioVenta: number; // Selling price in USD
  estado: PhoneStatus; // Current status
  clienteId?: string; // Reference to clients/{id} if sold
  fechaIngreso: Date; // Registration date
  fechaVenta?: Date; // Sale date
  reparaciones?: Repair[]; // Repair history
  statusHistory?: StatusChange[]; // Status change audit trail
  createdBy?: string; // UID of user who created
  updatedAt?: Date; // Last update timestamp
  photos?: string[]; // URLs in Storage (future)
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
  creditAmount: number;
  debtAmount: number;
  isWorkshopAccount: boolean;
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
  phoneId?: string;
  accessoryId?: string;
  description: string;
  price: number;
  quantity: number;
  imei?: string;
}
