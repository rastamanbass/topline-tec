import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import type { Phone } from '../../../types';

export interface StickerSize {
  width: number;
  height: number;
  label: string;
}

export const STICKER_SIZES: StickerSize[] = [
  { width: 40, height: 30, label: '40×30mm' },
  { width: 50, height: 30, label: '50×30mm' },
  { width: 60, height: 40, label: '60×40mm' },
  { width: 50, height: 40, label: '50×40mm' },
  { width: 40, height: 20, label: '40×20mm' },
  { width: 30, height: 20, label: '30×20mm' },
  { width: 70, height: 50, label: '70×50mm' },
  { width: 80, height: 50, label: '80×50mm' },
];

/**
 * Generate a PDF with one sticker per page at the exact physical label size.
 * Width/height in mm, landscape orientation (width > height).
 * Eduardo picks the size matching his roll, prints from Adobe/Jadens app.
 */
export function generateStickersPDF(
  phones: Phone[],
  width: number = 40,
  height: number = 30
): jsPDF {
  // Ensure landscape — width >= height
  const w = Math.max(width, height);
  const h = Math.min(width, height);

  const doc = new jsPDF({
    unit: 'mm',
    format: [w, h],
  });

  phones.forEach((phone, index) => {
    if (index > 0) {
      doc.addPage([w, h]);
    }

    drawSticker(doc, phone, w, h);
  });

  return doc;
}

function drawSticker(doc: jsPDF, phone: Phone, width: number, height: number) {
  // Dynamic layout based on sticker size
  // All sizes scaled proportionally to fit any label size

  const padding = Math.max(1, height * 0.04);
  const centerX = width / 2;

  // Font sizes scale with label height
  const modelFontSize = Math.max(6, height * 0.27);
  const loteFontSize = Math.max(4, height * 0.17);
  const imeiFontSize = Math.max(5, height * 0.2);

  // Barcode takes ~60% of height, ~95% of width
  const barcodeWidth = width * 0.95;
  const barcodeHeight = height * 0.6;
  const barcodeX = (width - barcodeWidth) / 2;

  // 1. Model + storage (top)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(modelFontSize);
  const modelText = phone.storage ? `${phone.modelo} ${phone.storage}` : phone.modelo;
  doc.text(modelText, centerX, padding + modelFontSize * 0.35, {
    align: 'center',
    maxWidth: width - 2,
  });

  // 2. Lote (below model)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(loteFontSize);
  doc.setTextColor(100);
  doc.text(phone.lote || '', centerX, padding + modelFontSize * 0.35 + loteFontSize * 0.4, {
    align: 'center',
    maxWidth: width - 2,
  });
  doc.setTextColor(0);

  // 3. Barcode — maximum size for scanner reliability
  const barcodeDataUrl = generateBarcodeDataUrl(phone.imei);
  if (barcodeDataUrl) {
    const barcodeY = padding + modelFontSize * 0.35 + loteFontSize * 0.4 + 0.5;
    doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
  }

  // 4. IMEI text (below barcode, at bottom)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(imeiFontSize);
  const imeiFormatted = formatImei(phone.imei);
  doc.text(imeiFormatted, centerX, height - padding - 0.2, { align: 'center' });
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
export function openStickersPDF(phones: Phone[], width: number = 40, height: number = 30): void {
  const doc = generateStickersPDF(phones, width, height);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

/**
 * Download the PDF directly.
 */
export function downloadStickersPDF(
  phones: Phone[],
  filename: string,
  width: number = 40,
  height: number = 30
): void {
  const doc = generateStickersPDF(phones, width, height);
  doc.save(filename);
}
