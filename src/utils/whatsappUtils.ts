/**
 * Utility functions for generating WhatsApp Click-to-Chat links.
 *
 * Pattern: generates a https://api.whatsapp.com/send URL with a pre-filled message.
 * The employee clicks the button → WhatsApp opens with the message → they press Send manually.
 * No API keys or Meta Business API required.
 */

import type { Invoice } from '../types';

// ── Phone formatting ──────────────────────────────────────────────────────────

/**
 * Cleans a phone number for use in a WhatsApp URL.
 *
 * Rules (US company — Top Line Tec, Miami FL):
 *   - Strip everything that is not a digit.
 *   - 10 digits  → add US country code prefix "1"
 *   - 11 digits  → assume already has country code, leave as-is
 *   - Any other length → leave as-is (could be international)
 */
export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return '1' + digits;
  }

  return digits;
}

// ── Date formatting ───────────────────────────────────────────────────────────

function formatInvoiceDate(ts: unknown): string {
  if (!ts) return new Date().toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
  if (ts instanceof Date) {
    return ts.toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  if (
    typeof ts === 'object' &&
    ts !== null &&
    typeof (ts as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (ts as { toDate: () => Date })
      .toDate()
      .toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return new Date().toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Message builder ───────────────────────────────────────────────────────────

/**
 * Builds the pre-filled WhatsApp message for a sale invoice.
 *
 * Format:
 *   Hola [clientName]! 👋
 *   Gracias por tu compra en *Top Line Tec* ✅
 *
 *   📄 *Factura [invoiceNumber]*
 *   📅 [fecha formateada]
 *   💰 *Total: $[total]*
 *
 *   📱 Equipo(s):
 *   • [modelo] [storage] — $[precio]
 *   ...
 *
 *   ¿Preguntas? Estamos aquí para ayudarte 🙏
 *   — *Top Line Tec* | Miami, FL
 */
function buildInvoiceMessage(invoice: Invoice): string {
  const clientName = invoice.clientName || 'Cliente';
  const fecha = formatInvoiceDate(invoice.issuedAt);
  const total = invoice.total.toFixed(2);

  const itemLines = invoice.items
    .map((item) => {
      const storage = item.storage ? ` ${item.storage}` : '';
      return `• ${item.description}${storage} — $${item.unitPrice.toFixed(2)}`;
    })
    .join('\n');

  return (
    `Hola ${clientName}! 👋\n` +
    `Gracias por tu compra en *Top Line Tec* ✅\n\n` +
    `📄 *Factura ${invoice.invoiceNumber}*\n` +
    `📅 ${fecha}\n` +
    `💰 *Total: $${total}*\n\n` +
    `📱 Equipo(s):\n` +
    `${itemLines}\n\n` +
    `¿Preguntas? Estamos aquí para ayudarte 🙏\n` +
    `— *Top Line Tec* | Miami, FL`
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates the WhatsApp Click-to-Chat URL for a sale invoice.
 * Returns an empty string if the invoice has no client phone.
 */
export function generateInvoiceWhatsAppLink(invoice: Invoice): string {
  if (!invoice.clientPhone) return '';

  const phone = formatPhoneForWhatsApp(invoice.clientPhone);
  if (!phone) return '';

  const message = buildInvoiceMessage(invoice);
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
}

/**
 * Opens WhatsApp in a new tab with the pre-filled invoice message.
 * Does nothing if the invoice has no client phone.
 */
export function openInvoiceWhatsApp(invoice: Invoice): void {
  const url = generateInvoiceWhatsAppLink(invoice);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
