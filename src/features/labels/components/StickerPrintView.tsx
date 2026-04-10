import { useMemo, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Printer, Download, FileText, Ruler } from 'lucide-react';
import {
  generateStickersPDF,
  downloadStickersPDF,
  openStickersPDF,
  STICKER_SIZES,
} from '../utils/stickerPdfGenerator';
import type { Phone } from '../../../types';

const SIZE_STORAGE_KEY = 'sticker-size-preference';

export default function StickerPrintView() {
  const { lote, imei } = useParams<{ lote?: string; imei?: string }>();

  // Load saved size preference or default to 40x30
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(SIZE_STORAGE_KEY);
    if (saved) {
      const [w] = saved.split('x').map(Number);
      if (w) return w;
    }
    return 40;
  });
  const [height, setHeight] = useState(() => {
    const saved = localStorage.getItem(SIZE_STORAGE_KEY);
    if (saved) {
      const [, h] = saved.split('x').map(Number);
      if (h) return h;
    }
    return 30;
  });

  // Save preference whenever it changes
  useEffect(() => {
    localStorage.setItem(SIZE_STORAGE_KEY, `${width}x${height}`);
  }, [width, height]);

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

  // Regenerate preview whenever phones or size change
  const previewUrl = useMemo(() => {
    if (phones.length === 0) return null;
    const doc = generateStickersPDF(phones, width, height);
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
  }, [phones, width, height]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando teléfonos...</div>;
  }

  if (phones.length === 0) {
    return <div className="p-8 text-center text-gray-500">No se encontraron teléfonos</div>;
  }

  const currentSizeLabel = `${width}×${height}mm`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left">
              <p className="text-lg font-bold text-gray-900">{lote || imei}</p>
              <p className="text-sm text-gray-500">
                {phones.length} stickers · {currentSizeLabel}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => openStickersPDF(phones, width, height)}
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
                    height
                  )
                }
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar
              </button>
            </div>
          </div>

          {/* Size selector */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Ruler className="w-4 h-4 text-amber-700" />
              <p className="text-sm font-semibold text-amber-900">
                Tamaño de etiqueta (medí el rollo con regla)
              </p>
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
                  setWidth(Math.max(10, Math.min(200, parseInt(e.target.value) || 40)))
                }
                className="w-16 px-2 py-1 border border-amber-300 rounded text-center"
              />
              <span className="text-amber-900">×</span>
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
              <span className="text-amber-700 text-xs ml-2">(se guarda automáticamente)</span>
            </div>
          </div>
        </div>
      </div>

      {previewUrl && (
        <div className="max-w-4xl mx-auto p-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-gray-200 flex items-center gap-2 text-sm font-semibold text-gray-600">
              <FileText className="w-4 h-4" />
              Vista previa del PDF · {currentSizeLabel}
            </div>
            <iframe
              src={previewUrl}
              title="PDF preview"
              className="w-full"
              style={{ height: '70vh', border: 'none' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
