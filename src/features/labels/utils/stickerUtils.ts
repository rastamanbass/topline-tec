const PRODUCTION_ORIGIN = 'https://inventario-a6aa3.web.app';

export function buildTrackingUrl(imei: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : PRODUCTION_ORIGIN;
  return `${origin}/phone/${imei}`;
}

export function formatStickerInfo(modelo: string, storage?: string): string {
  return [modelo, storage].filter(Boolean).join(' · ');
}

export function formatImeiDisplay(imei: string): string {
  if (imei.length !== 15) return imei;
  return `${imei.slice(0, 2)} ${imei.slice(2, 8)} ${imei.slice(8, 14)} ${imei.slice(14)}`;
}
