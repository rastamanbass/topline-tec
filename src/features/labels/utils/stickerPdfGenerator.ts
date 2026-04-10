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
  //   Center: barcode (large, wide, tall for scanning)
  //   Bottom: IMEI digits

  const padding = 1;
  const centerX = width / 2;

  // 1. Model + storage (top)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const modelText = phone.storage ? `${phone.modelo} ${phone.storage}` : phone.modelo;
  doc.text(modelText, centerX, padding + 2.5, { align: 'center', maxWidth: width - 2 });

  // 2. Lote (below model)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(100);
  doc.text(phone.lote || '', centerX, padding + 4.8, { align: 'center', maxWidth: width - 2 });
  doc.setTextColor(0);

  // 3. Barcode — maximum size for scanner reliability
  const barcodeDataUrl = generateBarcodeDataUrl(phone.imei);
  if (barcodeDataUrl) {
    const barcodeWidth = width - 2; // 38mm wide — almost full label
    const barcodeHeight = 18; // 18mm tall — big for scanning
    const barcodeX = (width - barcodeWidth) / 2;
    const barcodeY = padding + 5.5;
    doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
  }

  // 4. IMEI text (below barcode)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  const imeiFormatted = formatImei(phone.imei);
  doc.text(imeiFormatted, centerX, height - padding - 0.3, { align: 'center' });
}

function generateBarcodeDataUrl(imei: string): string | null {
  try {
    // Clean IMEI — only digits, no whitespace or symbols
    const cleanImei = imei.replace(/\D/g, '');
    if (cleanImei.length < 8) return null;

    const canvas = document.createElement('canvas');
    JsBarcode(canvas, cleanImei, {
      format: 'CODE128',
      width: 6, // thick bars at high resolution
      height: 180, // tall at high resolution
      displayValue: false,
      margin: 20, // big quiet zone
      background: '#ffffff',
      lineColor: '#000000',
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
