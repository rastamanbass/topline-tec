import {
  runTransaction,
  doc,
  getDoc,
  collection,
  serverTimestamp,
  type Transaction,
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import type { Invoice, InvoiceItem } from '../../types';

export interface CreateInvoiceData {
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
  transferDetails?: { number: string; name: string; bank: string };
  cashAmount?: number;
  notes?: string;
  phoneIds: string[];
  purchaseId?: string;
  orderId?: string;
  source: 'pos' | 'online';
}

/**
 * Atomically generates the next invoice number using settings/invoiceCounter.
 * Resets to 1 when the year changes.
 * Format: INV-{YEAR}-{0001}
 */
async function getNextInvoiceNumber(transaction: Transaction): Promise<string> {
  const counterRef = doc(db, 'settings', 'invoiceCounter');
  const counterDoc = await transaction.get(counterRef);

  const currentYear = new Date().getFullYear();
  let nextNumber = 1;

  if (counterDoc.exists()) {
    const data = counterDoc.data();
    // Only continue the sequence if same year
    if (data.year === currentYear) {
      nextNumber = (data.lastNumber as number || 0) + 1;
    }
    // If year changed, reset to 1
  }

  transaction.set(counterRef, { lastNumber: nextNumber, year: currentYear });

  return `INV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
}

/**
 * Creates an invoice document in Firestore atomically.
 * Uses a Firestore transaction to ensure sequential invoice numbers.
 * Returns the Firestore document ID of the created invoice.
 */
export async function createInvoice(data: CreateInvoiceData): Promise<string> {
  let invoiceId = '';

  await runTransaction(db, async (transaction) => {
    const invoiceNumber = await getNextInvoiceNumber(transaction);

    const invoiceRef = doc(collection(db, 'invoices'));
    invoiceId = invoiceRef.id;

    transaction.set(invoiceRef, {
      invoiceNumber,
      issuedAt: serverTimestamp(),
      issuedByEmail: auth.currentUser?.email || 'unknown',
      issuedByName: auth.currentUser?.displayName || null,
      company: {
        name: 'TOP LINE TEC',
        address: 'Miami, FL, USA',
        description: 'Compra-Venta de Dispositivos Móviles',
      },
      clientId: data.clientId || null,
      clientName: data.clientName,
      clientPhone: data.clientPhone || null,
      clientEmail: data.clientEmail || null,
      items: data.items,
      subtotal: data.subtotal,
      discountAmount: data.discountAmount,
      total: data.total,
      paymentMethod: data.paymentMethod,
      amountPaidWithCredit: data.amountPaidWithCredit || null,
      amountPaidWithWorkshopDebt: data.amountPaidWithWorkshopDebt || null,
      debtIncurred: data.debtIncurred || null,
      transferDetails: data.transferDetails || null,
      cashAmount: data.cashAmount || null,
      notes: data.notes || null,
      status: 'active',
      phoneIds: data.phoneIds,
      purchaseId: data.purchaseId || null,
      orderId: data.orderId || null,
      source: data.source,
    });
  });

  return invoiceId;
}

/**
 * Fetches a single invoice from Firestore.
 * Returns null if not found.
 */
export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  const snap = await getDoc(doc(db, 'invoices', invoiceId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Invoice;
}
