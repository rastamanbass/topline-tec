import { useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Printer, Download, FileText } from 'lucide-react';
import {
  generateStickersPDF,
  downloadStickersPDF,
  openStickersPDF,
} from '../utils/stickerPdfGenerator';
import type { Phone } from '../../../types';

export default function StickerPrintView() {
  const { lote, imei } = useParams<{ lote?: string; imei?: string }>();

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

  // Generate inline PDF preview when phones load
  const previewUrl = useMemo(() => {
    if (phones.length === 0) return null;
    const doc = generateStickersPDF(phones);
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
  }, [phones]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left">
            <p className="text-lg font-bold text-gray-900">{lote || imei}</p>
            <p className="text-sm text-gray-500">{phones.length} stickers · 40×30mm</p>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => openStickersPDF(phones)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              onClick={() =>
                downloadStickersPDF(phones, `stickers-${lote || imei || 'export'}.pdf`)
              }
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Descargar PDF
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          Imprimir desde Adobe / app Jadens con tamaño de papel 40×30mm landscape · margenes ninguno
          · escala 100%
        </p>
      </div>

      {previewUrl && (
        <div className="max-w-4xl mx-auto p-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-gray-200 flex items-center gap-2 text-sm font-semibold text-gray-600">
              <FileText className="w-4 h-4" />
              Vista previa del PDF
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
