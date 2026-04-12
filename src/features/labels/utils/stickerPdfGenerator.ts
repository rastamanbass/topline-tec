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

export type StickerOrientation = 'landscape' | 'portrait' | 'rotated';

export function generateStickersPDF(
  phones: Phone[],
  width: number = 50,
  height: number = 30,
  orientation: StickerOrientation = 'landscape'
): jsPDF {
  let pageW: number;
  let pageH: number;
  const contentW = Math.max(width, height);
  const contentH = Math.min(width, height);

  if (orientation === 'rotated') {
    pageW = contentH;
    pageH = contentW;
  } else if (orientation === 'landscape') {
    pageW = contentW;
    pageH = contentH;
  } else {
    pageW = contentH;
    pageH = contentW;
  }

  const jsPdfOrientation = pageW >= pageH ? 'landscape' : 'portrait';

  const doc = new jsPDF({
    unit: 'mm',
    format: [pageW, pageH],
    orientation: jsPdfOrientation,
  });

  phones.forEach((phone, index) => {
    if (index > 0) {
      doc.addPage([pageW, pageH], jsPdfOrientation);
    }

    if (orientation === 'rotated') {
      drawStickerRotated(doc, phone, contentW, contentH, pageW, pageH);
    } else {
      drawSticker(doc, phone, pageW, pageH);
    }
  });

  return doc;
}

function drawStickerRotated(
  doc: jsPDF,
  phone: Phone,
  contentW: number,
  contentH: number,
  _pageW: number,
  _pageH: number
) {
  // Render sticker content to a canvas, rotate 90° CW, embed as full-page image
  const dpi = 203;
  const canvasW = Math.round((contentW / 25.4) * dpi);
  const canvasH = Math.round((contentH / 25.4) * dpi);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';

  const paddingPx = Math.round((1.5 / 25.4) * dpi);
  const centerX = canvasW / 2;

  // Model
  const modelSize = Math.round(canvasH * 0.14);
  ctx.font = `bold ${modelSize}px Arial`;
  const modelText = phone.storage ? `${phone.modelo} ${phone.storage}` : phone.modelo;
  ctx.fillText(modelText, centerX, paddingPx + modelSize, canvasW - paddingPx * 2);

  // Lote
  const loteSize = Math.round(canvasH * 0.09);
  ctx.font = `${loteSize}px Arial`;
  ctx.fillStyle = '#555555';
  ctx.fillText(
    phone.lote || '',
    centerX,
    paddingPx + modelSize + loteSize + 4,
    canvasW - paddingPx * 2
  );
  ctx.fillStyle = '#000000';

  // Barcode
  const barcodeDataUrl = generateBarcodeDataUrl(phone.imei);
  if (barcodeDataUrl) {
    const barcodeImg = new Image();
    barcodeImg.src = barcodeDataUrl;

    const barcodeTop = paddingPx + modelSize + loteSize + 10;
    const imeiSize = Math.round(canvasH * 0.09);
    const barcodeAvailH = canvasH - barcodeTop - paddingPx - imeiSize - 6;
    const quietZonePx = Math.round((2 / 25.4) * dpi);

    // Draw barcode from the data URL canvas
    const barcodeCanvas = document.createElement('canvas');
    const cleanImei = phone.imei.replace(/\D/g, '');
    if (cleanImei.length >= 8) {
      JsBarcode(barcodeCanvas, cleanImei, {
        format: 'CODE128',
        width: 2,
        height: Math.round(barcodeAvailH * 0.9),
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
      ctx.drawImage(
        barcodeCanvas,
        quietZonePx,
        barcodeTop,
        canvasW - quietZonePx * 2,
        barcodeAvailH
      );
    }
  }

  // IMEI
  const imeiSize = Math.round(canvasH * 0.09);
  ctx.font = `bold ${imeiSize}px Arial`;
  ctx.fillText(formatImei(phone.imei), centerX, canvasH - paddingPx, canvasW - paddingPx * 2);

  // Rotate 90° CW: create rotated canvas (swap dimensions)
  const rotatedCanvas = document.createElement('canvas');
  rotatedCanvas.width = canvasH;
  rotatedCanvas.height = canvasW;
  const rctx = rotatedCanvas.getContext('2d')!;
  rctx.translate(canvasH, 0);
  rctx.rotate(Math.PI / 2);
  rctx.drawImage(canvas, 0, 0);

  // Embed rotated image filling entire portrait page
  const rotatedDataUrl = rotatedCanvas.toDataURL('image/png');
  doc.addImage(rotatedDataUrl, 'PNG', 0, 0, _pageW, _pageH);
}

function drawSticker(doc: jsPDF, phone: Phone, width: number, height: number) {
  const padding = Math.max(1, height * 0.05);
  const centerX = width / 2;

  const modelFontSize = Math.max(6, Math.min(10, height * 0.18));
  const loteFontSize = Math.max(4, Math.min(7, height * 0.12));
  const imeiFontSize = Math.max(5, Math.min(8, height * 0.14));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(modelFontSize);
  const modelText = phone.storage ? `${phone.modelo} ${phone.storage}` : phone.modelo;
  const modelY = padding + modelFontSize * 0.35;
  doc.text(modelText, centerX, modelY, {
    align: 'center',
    maxWidth: width - 2,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(loteFontSize);
  doc.setTextColor(80);
  const loteY = modelY + loteFontSize * 0.4 + 0.5;
  doc.text(phone.lote || '', centerX, loteY, {
    align: 'center',
    maxWidth: width - 2,
  });
  doc.setTextColor(0);

  const quietZone = 2;
  const barcodeWidthMM = width - quietZone * 2;
  const barcodeDataUrl = generateBarcodeDataUrl(phone.imei);
  if (barcodeDataUrl) {
    const barcodeTopY = loteY + 0.8;
    const bottomReserve = padding + imeiFontSize * 0.35 + 0.3;
    const barcodeHeightMM = height - barcodeTopY - bottomReserve;
    const barcodeX = (width - barcodeWidthMM) / 2;

    doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeTopY, barcodeWidthMM, barcodeHeightMM);
  }

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

export function openStickersPDF(
  phones: Phone[],
  width: number = 50,
  height: number = 30,
  orientation: StickerOrientation = 'landscape'
): void {
  const doc = generateStickersPDF(phones, width, height, orientation);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export function downloadStickersPDF(
  phones: Phone[],
  filename: string,
  width: number = 50,
  height: number = 30,
  orientation: StickerOrientation = 'landscape'
): void {
  const doc = generateStickersPDF(phones, width, height, orientation);
  doc.save(filename);
}
