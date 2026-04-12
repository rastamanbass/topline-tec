import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Printer, Download, FileText, Ruler, Monitor, RotateCcw } from 'lucide-react';
import {
  generateStickersPDF,
  downloadStickersPDF,
  openStickersPDF,
  STICKER_SIZES,
} from '../utils/stickerPdfGenerator';
import type { StickerOrientation } from '../utils/stickerPdfGenerator';
import { renderThermalPreview } from '../utils/thermalPreview';
import type { Phone } from '../../../types';

const SIZE_STORAGE_KEY = 'sticker-size-preference';
const ORIENTATION_STORAGE_KEY = 'sticker-orientation';
const THERMAL_SCALE = 3;

export default function StickerPrintView() {
  const { lote, imei } = useParams<{ lote?: string; imei?: string }>();
  const [thermalMode, setThermalMode] = useState(false);
  const thermalContainerRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(SIZE_STORAGE_KEY);
    if (saved) {
      const [w] = saved.split('x').map(Number);
      if (w) return w;
    }
    return 50;
  });
  const [height, setHeight] = useState(() => {
    const saved = localStorage.getItem(SIZE_STORAGE_KEY);
    if (saved) {
      const [, h] = saved.split('x').map(Number);
      if (h) return h;
    }
    return 30;
  });
  const [orientation, setOrientation] = useState<StickerOrientation>(() => {
    return (localStorage.getItem(ORIENTATION_STORAGE_KEY) as StickerOrientation) || 'landscape';
  });

  useEffect(() => {
    localStorage.setItem(SIZE_STORAGE_KEY, `${width}x${height}`);
  }, [width, height]);

  useEffect(() => {
    localStorage.setItem(ORIENTATION_STORAGE_KEY, orientation);
  }, [orientation]);

  const { data: phones = [], isLoading } = useQuery({
    queryKey: ['sticker-phones', lote, imei],
    queryFn: async () => {
      if (imei) {
        const q = query(collection(db, 'phones'), where('imei', '==', imei));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Phone);
      }
      if (lote) {
        const q = query(collection(db, 'phones'), where('lote', '==', lote));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Phone);
      }
      return [];
    },
  });

  const previewUrl = useMemo(() => {
    if (phones.length === 0 || thermalMode) return null;
    const doc = generateStickersPDF(phones, width, height, orientation);
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
  }, [phones, width, height, orientation, thermalMode]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const renderThermalPreviews = useCallback(() => {
    const container = thermalContainerRef.current;
    if (!container || !thermalMode || phones.length === 0) return;

    container.innerHTML = '';

    const previewW =
      orientation === 'landscape' ? Math.max(width, height) : Math.min(width, height);
    const previewH =
      orientation === 'landscape' ? Math.min(width, height) : Math.max(width, height);

    phones.forEach((phone, i) => {
      const canvas = renderThermalPreview(phone, previewW, previewH);

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'margin-bottom: 16px; text-align: center;';

      const label = document.createElement('p');
      label.textContent = `${i + 1}/${phones.length} — ${phone.imei}`;
      label.style.cssText =
        'font-size: 12px; color: #666; margin-bottom: 4px; font-family: monospace;';

      const scaled = document.createElement('canvas');
      scaled.width = canvas.width * THERMAL_SCALE;
      scaled.height = canvas.height * THERMAL_SCALE;
      scaled.style.cssText = `
        border: 1px solid #ccc;
        image-rendering: pixelated;
        width: ${canvas.width * THERMAL_SCALE}px;
        height: ${canvas.height * THERMAL_SCALE}px;
        background: white;
      `;

      const ctx = scaled.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);

      const info = document.createElement('p');
      info.textContent = `${canvas.width}x${canvas.height}px @ 203 DPI = ${previewW}x${previewH}mm (${orientation})`;
      info.style.cssText = 'font-size: 11px; color: #999; margin-top: 4px;';

      wrapper.appendChild(label);
      wrapper.appendChild(scaled);
      wrapper.appendChild(info);
      container.appendChild(wrapper);
    });
  }, [phones, width, height, orientation, thermalMode]);

  useEffect(() => {
    renderThermalPreviews();
  }, [renderThermalPreviews]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando telefonos...</div>;
  }

  if (phones.length === 0) {
    return <div className="p-8 text-center text-gray-500">No se encontraron telefonos</div>;
  }

  const currentSizeLabel = `${width}x${height}mm`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left">
              <p className="text-lg font-bold text-gray-900">{lote || imei}</p>
              <p className="text-sm text-gray-500">
                {phones.length} stickers · {currentSizeLabel} ·{' '}
                {orientation === 'landscape' ? 'Horizontal' : 'Vertical'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => setThermalMode(!thermalMode)}
                className={`px-4 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2 transition-colors ${
                  thermalMode
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-300'
                }`}
              >
                <Monitor className="w-4 h-4" />
                {thermalMode ? 'Termica ON' : 'Termica'}
              </button>
              <button
                onClick={() => openStickersPDF(phones, width, height, orientation)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
              <button
                onClick={() =>
                  downloadStickersPDF(
                    phones,
                    `stickers-${lote || imei || 'export'}.pdf`,
                    width,
                    height,
                    orientation
                  )
                }
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar
              </button>
            </div>
          </div>

          {/* Size + orientation selector */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-amber-700" />
                <p className="text-sm font-semibold text-amber-900">Tamano de etiqueta</p>
              </div>
              <button
                onClick={() =>
                  setOrientation(orientation === 'landscape' ? 'portrait' : 'landscape')
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {orientation === 'landscape' ? 'Horizontal' : 'Vertical'}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {STICKER_SIZES.map((size) => {
                const isActive = size.width === width && size.height === height;
                return (
                  <button
                    key={size.label}
                    onClick={() => {
                      setWidth(size.width);
                      setHeight(size.height);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-amber-600 text-white'
                        : 'bg-white text-amber-800 hover:bg-amber-100 border border-amber-300'
                    }`}
                  >
                    {size.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-amber-900 font-medium">Personalizado:</span>
              <input
                type="number"
                min="10"
                max="200"
                value={width}
                onChange={(e) =>
                  setWidth(Math.max(10, Math.min(200, parseInt(e.target.value) || 50)))
                }
                className="w-16 px-2 py-1 border border-amber-300 rounded text-center"
              />
              <span className="text-amber-900">x</span>
              <input
                type="number"
                min="10"
                max="200"
                value={height}
                onChange={(e) =>
                  setHeight(Math.max(10, Math.min(200, parseInt(e.target.value) || 30)))
                }
                className="w-16 px-2 py-1 border border-amber-300 rounded text-center"
              />
              <span className="text-amber-900">mm</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {thermalMode ? (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-gray-200 flex items-center gap-2 text-sm font-semibold text-orange-700 bg-orange-50">
              <Monitor className="w-4 h-4" />
              Emulador Termico · 203 DPI · {currentSizeLabel} ·{' '}
              {orientation === 'landscape' ? 'Horizontal' : 'Vertical'} · Escala {THERMAL_SCALE}x
            </div>
            <div className="p-4 text-center overflow-x-auto" ref={thermalContainerRef} />
            <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
              Cada pixel = 1 punto de la impresora (0.125mm). Si las barras se ven limpias aqui, se
              imprimen bien.
            </div>
          </div>
        ) : (
          previewUrl && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-3 border-b border-gray-200 flex items-center gap-2 text-sm font-semibold text-gray-600">
                <FileText className="w-4 h-4" />
                Vista previa del PDF · {currentSizeLabel} ·{' '}
                {orientation === 'landscape' ? 'Horizontal' : 'Vertical'}
              </div>
              <iframe
                src={previewUrl}
                title="PDF preview"
                className="w-full"
                style={{ height: '70vh', border: 'none' }}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}
