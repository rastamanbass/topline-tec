import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import type { Phone } from '../../../types';

/**
 * Generate a PDF with one sticker per page at the exact physical label size.
 * Each page is 40x30mm landscape (Jadens JD268BT default).
 * Eduardo downloads this PDF and prints it from the Jadens app or Adobe Reader
 * with paper size set to match.
 */
export function generateStickersPDF(phones: Phone[]): jsPDF {
  // Sticker dimensions in mm — adjust here if rolls change
  const PAGE_WIDTH = 40;
  const PAGE_HEIGHT = 30;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [PAGE_WIDTH, PAGE_HEIGHT],
  });

  phones.forEach((phone, index) => {
    if (index > 0) {
      doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'landscape');
    }

    drawSticker(doc, phone, PAGE_WIDTH, PAGE_HEIGHT);
  });

  return doc;
}

function drawSticker(doc: jsPDF, phone: Phone, width: number, height: number) {
  // Layout zones (in mm):
  //   Top: model + storage (centered)
  //   Below: lote
  //   Center: barcode (large)
  //   Bottom: IMEI digits

  const padding = 1.5;
  const centerX = width / 2;

  // 1. Model + storage (top)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const modelText = phone.storage ? `${phone.modelo} ${phone.storage}` : phone.modelo;
  doc.text(modelText, centerX, padding + 3, { align: 'center', maxWidth: width - 2 });

  // 2. Lote (below model)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100);
  doc.text(phone.lote || '', centerX, padding + 6, { align: 'center', maxWidth: width - 2 });
  doc.setTextColor(0);

  // 3. Barcode (center, large) — generate via JsBarcode to canvas
  const barcodeDataUrl = generateBarcodeDataUrl(phone.imei);
  if (barcodeDataUrl) {
    const barcodeWidth = width - 4; // 36mm wide
    const barcodeHeight = 14; // 14mm tall
    const barcodeX = (width - barcodeWidth) / 2;
    const barcodeY = padding + 8;
    doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
  }

  // 4. IMEI text (below barcode)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const imeiFormatted = formatImei(phone.imei);
  doc.text(imeiFormatted, centerX, height - padding - 0.5, { align: 'center' });
}

function generateBarcodeDataUrl(imei: string): string | null {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, imei, {
      format: 'CODE128',
      width: 3,
      height: 60,
      displayValue: false,
      margin: 0,
    });
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Failed to generate barcode for', imei, e);
    return null;
  }
}

function formatImei(imei: string): string {
  if (imei.length !== 15) return imei;
  return `${imei.slice(0, 2)} ${imei.slice(2, 8)} ${imei.slice(8, 14)} ${imei.slice(14)}`;
}

/**
 * Open the PDF in a new tab so Eduardo can print it from there
 * with full control over paper size in the system print dialog.
 */
export function openStickersPDF(phones: Phone[]): void {
  const doc = generateStickersPDF(phones);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

/**
 * Download the PDF directly.
 */
export function downloadStickersPDF(phones: Phone[], filename: string): void {
  const doc = generateStickersPDF(phones);
  doc.save(filename);
}
