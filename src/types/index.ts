export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: 'admin' | 'gerente' | 'vendedor' | 'comprador';
}

export interface Phone {
  id: string;
  imei: string;
  marca: string;
  modelo: string;
  lote: string;
  costo: number;
  precioVenta: number;
  estado: PhoneStatus;
  clienteId?: string;
  fechaIngreso: Date;
  fechaVenta?: string;
  photos?: string[];
  reparaciones?: Repair[];
  statusHistory?: StatusChange[];
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
  date: string;
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
