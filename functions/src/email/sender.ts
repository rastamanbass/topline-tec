/**
 * sender.ts — Resend email wrapper for Cloud Functions.
 * Lazy-initializes Resend client using RESEND_API_KEY secret.
 * All sends are best-effort: errors are logged but never thrown.
 */

import { Resend } from "resend";
import type { InvoiceData } from "./types";
import type { ShipmentEmailData } from "./template";
import { invoiceEmailHtml, shipmentEmailHtml } from "./template";
import { buildPdfBase64 } from "./buildPdf";

const FROM_ADDRESS = "Top Line Tec <noreply@toplinetec.com>";

let _resend: Resend | null = null;

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY no configurado");
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

// ── Send invoice email (order paid) ───────────────────────────────────────────

export async function sendInvoiceEmail(inv: InvoiceData, to: string): Promise<void> {
  const resend = getResend();
  const html = invoiceEmailHtml(inv);

  // Generate PDF — graceful fallback if jsPDF fails in Node.js
  let pdfBase64: string | undefined;
  try {
    pdfBase64 = await buildPdfBase64(inv);
  } catch (pdfErr) {
    console.warn("[Email] PDF generation failed, sending without attachment:", pdfErr);
  }

  const attachments = pdfBase64
    ? [{ filename: `${inv.invoiceNumber}.pdf`, content: pdfBase64 }]
    : [];

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `${inv.invoiceNumber} — Tu acta de venta Top Line Tec`,
    html,
    attachments,
  });

  if (error) {
    console.error("[Email] Resend error sending invoice:", error);
  } else {
    console.log(`[Email] Invoice email sent to ${to} (${inv.invoiceNumber})`);
  }
}

// ── Send shipment status email ─────────────────────────────────────────────────

export async function sendShipmentEmail(
  data: ShipmentEmailData,
  to: string,
  statusTitle: string,
  statusKey?: string
): Promise<void> {
  const resend = getResend();
  const html = shipmentEmailHtml(data, statusKey);

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `${statusTitle} — Top Line Tec`,
    html,
  });

  if (error) {
    console.error("[Email] Resend error sending shipment update:", error);
  } else {
    console.log(`[Email] Shipment email sent to ${to}`);
  }
}
