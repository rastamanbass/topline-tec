/**
 * Server-side invoice types for Cloud Functions email/PDF generation.
 * Mirrors the subset of src/types/index.ts needed here.
 */

export interface InvoiceItemData {
  description: string;
  imei?: string;
  condition?: string;
  storage?: string;
  quantity: number;
  unitPrice: number;
  subtotalLine: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  issuedAt: Date;
  issuedByEmail: string;

  clientName: string;
  clientPhone?: string;
  clientEmail?: string;

  items: InvoiceItemData[];

  subtotal: number;
  discountAmount: number;
  amountPaidWithCredit?: number;
  debtIncurred?: number;
  total: number;

  paymentMethod: string;
  transferDetails?: { number: string; name: string; bank: string };

  notes?: string;
  orderId?: string;
  source: "pos" | "online";
}
