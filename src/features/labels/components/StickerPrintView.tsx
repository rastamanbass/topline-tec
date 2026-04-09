import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import PhoneStickerLabel from './PhoneStickerLabel';
import { Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Phone } from '../../../types';

const BATCH_SIZE = 25;

export default function StickerPrintView() {
  const { lote, imei } = useParams<{ lote?: string; imei?: string }>();
  const [page, setPage] = useState(0);

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

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando teléfonos...</div>;
  }

  if (phones.length === 0) {
    return <div className="p-8 text-center text-gray-500">No se encontraron teléfonos</div>;
  }

  const totalPages = Math.ceil(phones.length / BATCH_SIZE);
  const start = page * BATCH_SIZE;
  const end = Math.min(start + BATCH_SIZE, phones.length);
  const currentBatch = phones.slice(start, end);

  return (
    <div>
      {/* Controls - hidden when printing */}
      <div className="no-print bg-gray-100 p-4 text-center space-y-3 sticky top-0 z-10">
        <p className="text-lg font-bold">
          {lote || imei} — {phones.length} stickers
        </p>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2.5 rounded-lg bg-white border border-gray-300 disabled:opacity-30 hover:bg-gray-50"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="text-base font-medium text-gray-700">
              Lote {page + 1} de {totalPages} — stickers {start + 1}-{end}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-2.5 rounded-lg bg-white border border-gray-300 disabled:opacity-30 hover:bg-gray-50"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}

        <button
          onClick={() => window.print()}
          className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-semibold inline-flex items-center gap-2 text-lg"
        >
          <Printer className="w-5 h-5" />
          Imprimir {currentBatch.length} stickers
        </button>

        <p className="text-xs text-gray-500">Papel 60×40mm · Sin márgenes</p>
      </div>

      {/* Sticker previews */}
      <div className="flex flex-col items-center gap-4 p-4 print-area">
        {currentBatch.map((phone, i) => (
          <PhoneStickerLabel key={phone.id} phone={phone} index={start + i} total={phones.length} />
        ))}
      </div>

      <style>{`
        @media print {
          @page {
            size: 60mm 40mm;
            margin: 0;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }

          .no-print, nav, header, footer {
            display: none !important;
          }

          .print-area {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            gap: 0 !important;
          }

          .sticker-label {
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            aspect-ratio: auto !important;
            margin: 0 !important;
            padding: 2vmin !important;
            border: none !important;
            border-radius: 0 !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .sticker-label:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          /* Zone A: Model + Storage (inline) */
          .sticker-label > div:first-child {
            display: flex !important;
            flex: none !important;
            align-items: baseline !important;
            gap: 3vmin !important;
            margin-bottom: 0 !important;
          }

          /* Model text */
          .sticker-label > div:first-child > p {
            font-size: 7vmin !important;
            font-weight: bold !important;
            line-height: 1.1 !important;
            margin: 0 !important;
          }

          /* Storage text (inline span) */
          .sticker-label > div:first-child > span {
            font-size: 5vmin !important;
          }

          /* Lote text (below model row) */
          .sticker-label > p:first-of-type {
            font-size: 4vmin !important;
            margin: 1vmin 0 0 !important;
          }

          /* Zone B: QR code container */
          .sticker-label > div:nth-child(3) {
            margin-top: 2vmin !important;
            flex: none !important;
          }

          /* QR SVG — bigger for scanning */
          .sticker-label > div:nth-child(3) > svg {
            width: 25vmin !important;
            height: 25vmin !important;
          }

          /* Zone C: Barcode container — pushed to bottom with gap */
          .sticker-label > div:nth-child(4) {
            margin-top: auto !important;
            padding-top: 5vmin !important;
            text-align: center !important;
          }

          /* Barcode SVG — full width, taller */
          .sticker-label > div:nth-child(4) > svg {
            width: 85% !important;
            height: auto !important;
            max-height: 20vmin !important;
          }

          /* IMEI text below barcode */
          .sticker-label > div:nth-child(4) > p {
            font-size: 4vmin !important;
            font-weight: bold !important;
            letter-spacing: 0.12em !important;
            margin: 1vmin 0 0 !important;
            line-height: 1 !important;
          }

          /* Counter */
          .sticker-label > p:last-child {
            font-size: 3vmin !important;
            margin: 0 !important;
            line-height: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
