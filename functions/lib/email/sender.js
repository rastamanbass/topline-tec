"use strict";
/**
 * sender.ts — Resend email wrapper for Cloud Functions.
 * Lazy-initializes Resend client using RESEND_API_KEY secret.
 * All sends are best-effort: errors are logged but never thrown.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInvoiceEmail = sendInvoiceEmail;
exports.sendShipmentEmail = sendShipmentEmail;
const resend_1 = require("resend");
const template_1 = require("./template");
const buildPdf_1 = require("./buildPdf");
const FROM_ADDRESS = "Top Line Tec <noreply@toplinetec.com>";
let _resend = null;
function getResend() {
    const key = process.env.RESEND_API_KEY;
    if (!key)
        throw new Error("RESEND_API_KEY no configurado");
    if (!_resend)
        _resend = new resend_1.Resend(key);
    return _resend;
}
// ── Send invoice email (order paid) ───────────────────────────────────────────
async function sendInvoiceEmail(inv, to) {
    const resend = getResend();
    const html = (0, template_1.invoiceEmailHtml)(inv);
    // Generate PDF — graceful fallback if jsPDF fails in Node.js
    let pdfBase64;
    try {
        pdfBase64 = await (0, buildPdf_1.buildPdfBase64)(inv);
    }
    catch (pdfErr) {
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
    }
    else {
        console.log(`[Email] Invoice email sent to ${to} (${inv.invoiceNumber})`);
    }
}
// ── Send shipment status email ─────────────────────────────────────────────────
async function sendShipmentEmail(data, to, statusTitle, statusKey) {
    const resend = getResend();
    const html = (0, template_1.shipmentEmailHtml)(data, statusKey);
    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: `${statusTitle} — Top Line Tec`,
        html,
    });
    if (error) {
        console.error("[Email] Resend error sending shipment update:", error);
    }
    else {
        console.log(`[Email] Shipment email sent to ${to}`);
    }
}
//# sourceMappingURL=sender.js.map