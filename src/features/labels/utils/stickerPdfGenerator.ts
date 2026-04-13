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
    orientation: 'landscape',
    unit: 'mm',
    format: [w, h],
  });

  phones.forEach((phone, index) => {
    if (index > 0) {
      doc.addPage([w, h], 'landscape');
    }

    drawSticker(doc, phone, w, h);
  });

  return doc;
}

function drawSticker(doc: jsPDF, phone: Phone, width: number, height: number) {
  const padding = Math.max(1, height * 0.04);
  const centerX = width / 2;

  const modelFontSize = Math.max(6, height * 0.27);
  const loteFontSize = Math.max(4, height * 0.17);
  const imeiFontSize = Math.max(5, height * 0.2);

  const barcodeWidth = width * 0.95;
  const barcodeHeight = height * 0.6;
  const barcodeX = (width - barcodeWidth) / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(modelFontSize);
  const modelText = phone.storage ? `${phone.modelo} ${phone.storage}` : phone.modelo;
  doc.text(modelText, centerX, padding + modelFontSize * 0.35, {
    align: 'center',
    maxWidth: width - 2,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(loteFontSize);
  doc.setTextColor(100);
  doc.text(phone.lote || '', centerX, padding + modelFontSize * 0.35 + loteFontSize * 0.4, {
    align: 'center',
    maxWidth: width - 2,
  });
  doc.setTextColor(0);

  const barcodeDataUrl = generateBarcodeDataUrl(phone.imei);
  if (barcodeDataUrl) {
    const barcodeY = padding + modelFontSize * 0.35 + loteFontSize * 0.4 + 0.5;
    doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(imeiFontSize);
  const imeiFormatted = formatImei(phone.imei);
  doc.text(imeiFormatted, centerX, height - padding - 0.2, { align: 'center' });
}

function generateBarcodeDataUrl(imei: string): string | null {
  try {
    const cleanImei = imei.replace(/\D/g, '');
    if (cleanImei.length < 8) return null;

    const canvas = document.createElement('canvas');
    JsBarcode(canvas, cleanImei, {
      format: 'CODE128',
      width: 6,
      height: 180,
      displayValue: false,
      margin: 20,
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
