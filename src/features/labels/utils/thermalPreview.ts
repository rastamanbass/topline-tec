import JsBarcode from 'jsbarcode';
import type { Phone } from '../../../types';

const DPI = 203;

function mmToPx(mm: number): number {
  return Math.round((mm / 25.4) * DPI);
}

export function renderThermalPreview(
  phone: Phone,
  widthMM: number = 50,
  heightMM: number = 30
): HTMLCanvasElement {
  const w = mmToPx(Math.max(widthMM, heightMM));
  const h = mmToPx(Math.min(widthMM, heightMM));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';

  const paddingPx = mmToPx(1.5);
  const centerX = w / 2;

  // 1. Model + storage
  const modelSize = Math.round(h * 0.14);
  ctx.font = `bold ${modelSize}px Arial`;
  const modelText = phone.storage ? `${phone.modelo} ${phone.storage}` : phone.modelo;
  const modelY = paddingPx + modelSize;
  ctx.fillText(modelText, centerX, modelY, w - paddingPx * 2);

  // 2. Lote
  const loteSize = Math.round(h * 0.09);
  ctx.font = `${loteSize}px Arial`;
  ctx.fillStyle = '#555555';
  const loteY = modelY + loteSize + 2;
  ctx.fillText(phone.lote || '', centerX, loteY, w - paddingPx * 2);
  ctx.fillStyle = '#000000';

  // 3. Barcode
  const barcodeTopY = loteY + mmToPx(1);
  const imeiSize = Math.round(h * 0.09);
  const bottomReserve = paddingPx + imeiSize + 2;
  const barcodeHeight = h - barcodeTopY - bottomReserve;
  const quietZonePx = mmToPx(2);
  const barcodeWidth = w - quietZonePx * 2;

  const barcodeCanvas = generateBarcode(phone.imei, barcodeWidth, barcodeHeight);
  if (barcodeCanvas) {
    const barcodeX = (w - barcodeCanvas.width) / 2;
    ctx.drawImage(barcodeCanvas, barcodeX, barcodeTopY, barcodeCanvas.width, barcodeHeight);
  }

  // 4. IMEI
  ctx.font = `bold ${imeiSize}px Arial`;
  const imeiFormatted = formatImei(phone.imei);
  ctx.fillText(imeiFormatted, centerX, h - paddingPx, w - paddingPx * 2);

  return canvas;
}

function generateBarcode(
  imei: string,
  maxWidth: number,
  _maxHeight: number
): HTMLCanvasElement | null {
  try {
    const cleanImei = imei.replace(/\D/g, '');
    if (cleanImei.length < 8) return null;

    const barcodeCanvas = document.createElement('canvas');
    JsBarcode(barcodeCanvas, cleanImei, {
      format: 'CODE128',
      width: 2,
      height: Math.round(_maxHeight * 0.85),
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    });

    if (barcodeCanvas.width > maxWidth) {
      JsBarcode(barcodeCanvas, cleanImei, {
        format: 'CODE128',
        width: 1,
        height: Math.round(_maxHeight * 0.85),
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
    }

    return barcodeCanvas;
  } catch {
    return null;
  }
}

function formatImei(imei: string): string {
  if (imei.length !== 15) return imei;
  return `${imei.slice(0, 2)} ${imei.slice(2, 8)} ${imei.slice(8, 14)} ${imei.slice(14)}`;
}
