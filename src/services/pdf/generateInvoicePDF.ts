/**
 * generateInvoicePDF.ts
 *
 * Generates a professional PDF invoice for Top Line Tec.
 * Works in both browser (Vite/React) and Node.js (Cloud Functions) environments.
 *
 * Exports:
 *   generateInvoicePDF(invoice)  → Promise<Blob>   (universal)
 *   downloadInvoicePDF(invoice)  → void             (browser only)
 *   invoiceToBase64(invoice)     → Promise<string>  (universal, for WhatsApp/email)
 */

import type { jsPDF as JsPDFType } from 'jspdf';
import type { Invoice } from '../../types';

async function loadPdfLibs() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { jsPDF, autoTable };
}

// ── Palette ────────────────────────────────────────────────────────────────────
const DARK_BLUE: [number, number, number] = [30, 58, 138]; // #1e3a8a
const WHITE: [number, number, number] = [255, 255, 255];
const GRAY_900: [number, number, number] = [17, 24, 39];
const GRAY_600: [number, number, number] = [75, 85, 99];
const GRAY_300: [number, number, number] = [209, 213, 219];
const RED: [number, number, number] = [220, 38, 38];
const GREEN: [number, number, number] = [21, 128, 61];
const AMBER: [number, number, number] = [180, 83, 9];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Safely converts a Firestore Timestamp, Date, or unknown to a Date.
 * Falls back to now() if the value cannot be parsed.
 */
function toDate(ts: unknown): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (
    typeof ts === 'object' &&
    ts !== null &&
    typeof (ts as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (ts as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function formatDate(ts: unknown): string {
  return toDate(ts).toLocaleDateString('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(ts: unknown): string {
  return toDate(ts).toLocaleTimeString('es-SV', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Core builder ───────────────────────────────────────────────────────────────

/**
 * Builds a jsPDF document from an Invoice and returns it.
 * All layout constants are in millimeters (A4: 210 × 297 mm).
 */
async function buildPDF(invoice: Invoice): Promise<JsPDFType> {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth(); // 210
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR; // 180
  let y = 15;

  // ── Header band ─────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK_BLUE);
  doc.rect(0, 0, pageW, 28, 'F');

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text('TOP LINE TEC', marginL, y + 8);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 200, 240);
  doc.text('Compra-Venta de Dispositivos Mobiles  ·  Miami, FL, USA', marginL, y + 15);

  // Invoice number block (top-right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(invoice.invoiceNumber, pageW - marginR, y + 8, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(180, 200, 240);
  doc.text('ACTA DE VENTA', pageW - marginR, y + 14, { align: 'right' });

  y = 34;

  // ── Client / Date grid ───────────────────────────────────────────────────────
  const colLeft = marginL;
  const colRight = marginL + contentW / 2 + 5;

  // Left column: client
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...DARK_BLUE);
  doc.text('FACTURADO A', colLeft, y);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY_900);
  doc.text(invoice.clientName, colLeft, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY_600);

  if (invoice.clientPhone) {
    doc.text(invoice.clientPhone, colLeft, y);
    y += 4.5;
  }
  if (invoice.clientEmail) {
    doc.text(invoice.clientEmail, colLeft, y);
    y += 4.5;
  }

  // Right column: date (reset y to grid top)
  const gridTopY = 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...DARK_BLUE);
  doc.text('FECHA Y HORA', colRight, gridTopY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY_900);
  doc.text(formatDate(invoice.issuedAt), colRight, gridTopY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY_600);
  doc.text(formatTime(invoice.issuedAt), colRight, gridTopY + 8.5);

  doc.setFontSize(7.5);
  doc.text(`Vendedor: ${invoice.issuedByEmail}`, colRight, gridTopY + 13);

  // Separator line
  y = Math.max(y, gridTopY + 18) + 3;
  doc.setDrawColor(...GRAY_300);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, pageW - marginR, y);
  y += 5;

  // ── Items table ──────────────────────────────────────────────────────────────
  const tableHead = [['#', 'Descripcion', 'IMEI', 'Cant.', 'Precio Unit.', 'Subtotal']];
  const tableBody = invoice.items.map((item, idx) => {
    const imeiDisplay = item.imei ? `...${item.imei.slice(-6)}` : '—';
    const detail = [item.condition, item.storage].filter(Boolean).join(' · ');
    const descCell = detail ? `${item.description}\n${detail}` : item.description;
    return [
      String(idx + 1),
      descCell,
      imeiDisplay,
      String(item.quantity),
      formatCurrency(item.unitPrice),
      formatCurrency(item.subtotalLine),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: marginL, right: marginR },
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      textColor: GRAY_900,
      lineColor: GRAY_300,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: DARK_BLUE,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250] as [number, number, number],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 26, font: 'courier', fontSize: 7.5, textColor: GRAY_600 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
    },
    didDrawPage: (data) => {
      // Repeat header on overflow pages
      if (data.pageNumber > 1) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY_600);
        doc.text(`${invoice.invoiceNumber}  ·  TOP LINE TEC  ·  (cont.)`, marginL, 10);
      }
    },
  });

  // Capture y after table
  const afterTableY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  y = afterTableY;

  // ── Totals block ─────────────────────────────────────────────────────────────
  const totalsX = pageW - marginR - 70;
  const valX = pageW - marginR;

  const totalItems = invoice.items.reduce((s, i) => s + i.quantity, 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY_600);
  doc.text(`Subtotal (${totalItems} ${totalItems === 1 ? 'item' : 'items'})`, totalsX, y);
  doc.text(formatCurrency(invoice.subtotal), valX, y, { align: 'right' });
  y += 5;

  if (invoice.discountAmount > 0) {
    doc.setTextColor(...RED);
    doc.text('Descuento', totalsX, y);
    doc.text(`-${formatCurrency(invoice.discountAmount)}`, valX, y, { align: 'right' });
    y += 5;
  }

  if (invoice.amountPaidWithCredit && invoice.amountPaidWithCredit > 0) {
    doc.setTextColor(...GREEN);
    doc.text('Credito aplicado', totalsX, y);
    doc.text(`-${formatCurrency(invoice.amountPaidWithCredit)}`, valX, y, { align: 'right' });
    y += 5;
  }

  // Total line
  doc.setDrawColor(...GRAY_900);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y, valX, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GRAY_900);
  doc.text('TOTAL', totalsX, y);
  doc.text(formatCurrency(invoice.total), valX, y, { align: 'right' });
  y += 8;

  // ── Payment details ──────────────────────────────────────────────────────────
  doc.setDrawColor(...GRAY_300);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, pageW - marginR, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...DARK_BLUE);
  doc.text('METODO DE PAGO', marginL, y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_900);
  doc.text(invoice.paymentMethod, marginL, y);
  y += 5;

  if (invoice.transferDetails) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_600);
    const td = invoice.transferDetails;
    doc.text(`Ref: ${td.number}  ·  ${td.bank}  ·  ${td.name}`, marginL, y);
    y += 5;
  }

  if (invoice.debtIncurred && invoice.debtIncurred > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...AMBER);
    doc.text(`Deuda generada: ${formatCurrency(invoice.debtIncurred)}`, marginL, y);
    y += 5;
  }

  // ── Notes ────────────────────────────────────────────────────────────────────
  if (invoice.notes) {
    y += 2;
    doc.setFillColor(248, 249, 250);
    const noteLines = doc.splitTextToSize(`Nota: ${invoice.notes}`, contentW - 10) as string[];
    const noteH = noteLines.length * 4.5 + 5;
    doc.roundedRect(marginL, y, contentW, noteH, 2, 2, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_600);
    doc.text(noteLines, marginL + 4, y + 4.5);
    y += noteH + 4;
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  const footerY = pageH - 12;

  doc.setDrawColor(...GRAY_300);
  doc.setLineWidth(0.3);
  doc.line(marginL, footerY - 3, pageW - marginR, footerY - 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_600);
  doc.text(
    'Este documento no tiene valor fiscal.  ·  TOP LINE TEC  ·  Miami, FL, USA',
    pageW / 2,
    footerY,
    { align: 'center' }
  );

  doc.setFontSize(6.5);
  doc.setTextColor(156, 163, 175);
  doc.text(invoice.invoiceNumber, pageW / 2, footerY + 4, { align: 'center' });

  return doc;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generates a PDF from an invoice and returns it as a Blob.
 * Works in both browser and Node.js environments.
 */
export async function generateInvoicePDF(invoice: Invoice): Promise<Blob> {
  const doc = await buildPDF(invoice);
  return doc.output('blob');
}

/**
 * Immediately triggers a browser download of the invoice PDF.
 * Browser-only — do not call from Cloud Functions.
 */
export async function downloadInvoicePDF(invoice: Invoice): Promise<void> {
  const doc = await buildPDF(invoice);
  const filename = `${invoice.invoiceNumber}.pdf`;
  doc.save(filename);
}

/**
 * Returns the invoice PDF encoded as a Base64 string (without the data-URI prefix).
 * Suitable for attaching to WhatsApp messages or email APIs.
 */
export async function invoiceToBase64(invoice: Invoice): Promise<string> {
  const doc = await buildPDF(invoice);
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1] ?? '';
}
