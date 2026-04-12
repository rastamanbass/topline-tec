import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import type { Phone } from '../../../types';

export interface StickerSize {
  width: number;
  height: number;
  label: string;
}

export const STICKER_SIZES: StickerSize[] = [
  { width: 50, height: 30, label: '50×30mm' },
  { width: 40, height: 30, label: '40×30mm' },
  { width: 60, height: 40, label: '60×40mm' },
  { width: 50, height: 40, label: '50×40mm' },
  { width: 40, height: 20, label: '40×20mm' },
  { width: 30, height: 20, label: '30×20mm' },
  { width: 70, height: 50, label: '70×50mm' },
  { width: 80, height: 50, label: '80×50mm' },
];

export function generateStickersPDF(
  phones: Phone[],
  width: number = 50,
  height: number = 30
): jsPDF {
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
  const padding = Math.max(1, height * 0.05);
  const centerX = width / 2;

  const modelFontSize = Math.max(7, height * 0.28);
  const loteFontSize = Math.max(4, height * 0.15);
  const imeiFontSize = Math.max(5, height * 0.18);

  // 1. Model + storage (top, bold)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(modelFontSize);
  const modelText = phone.storage ? `${phone.modelo} ${phone.storage}` : phone.modelo;
  const modelY = padding + modelFontSize * 0.35;
  doc.text(modelText, centerX, modelY, {
    align: 'center',
    maxWidth: width - 2,
  });

  // 2. Lote / envio (below model)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(loteFontSize);
  doc.setTextColor(80);
  const loteY = modelY + loteFontSize * 0.5 + 0.5;
  doc.text(phone.lote || '', centerX, loteY, {
    align: 'center',
    maxWidth: width - 2,
  });
  doc.setTextColor(0);

  // 3. Barcode — high-res CODE128 scaled to fill label width
  const quietZone = 2;
  const barcodeWidthMM = width - quietZone * 2;
  const barcodeDataUrl = generateBarcodeDataUrl(phone.imei);
  if (barcodeDataUrl) {
    const barcodeTopY = loteY + 1;
    const bottomReserve = padding + imeiFontSize * 0.35 + 0.5;
    const barcodeHeightMM = height - barcodeTopY - bottomReserve;
    const barcodeX = (width - barcodeWidthMM) / 2;

    doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeTopY, barcodeWidthMM, barcodeHeightMM);
  }

  // 4. IMEI text (bottom)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(imeiFontSize);
  const imeiFormatted = formatImei(phone.imei);
  doc.text(imeiFormatted, centerX, height - padding, { align: 'center' });
}

function generateBarcodeDataUrl(imei: string): string | null {
  try {
    const cleanImei = imei.replace(/\D/g, '');
    if (cleanImei.length < 8) return null;

    const canvas = document.createElement('canvas');
    JsBarcode(canvas, cleanImei, {
      format: 'CODE128',
      width: 5,
      height: 120,
      displayValue: false,
      margin: 0,
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

export function openStickersPDF(phones: Phone[], width: number = 50, height: number = 30): void {
  const doc = generateStickersPDF(phones, width, height);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export function downloadStickersPDF(
  phones: Phone[],
  filename: string,
  width: number = 50,
  height: number = 30
): void {
  const doc = generateStickersPDF(phones, width, height);
  doc.save(filename);
}
