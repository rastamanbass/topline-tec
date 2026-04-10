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

          html, body, .print-area {
            margin: 0 !important;
            padding: 0 !important;
            width: 60mm !important;
            height: auto !important;
          }

          .print-area {
            display: block !important;
            gap: 0 !important;
          }

          .sticker-label {
            width: 60mm !important;
            height: 40mm !important;
            max-width: none !important;
            aspect-ratio: auto !important;
            margin: 0 !important;
            padding: 0.5mm !important;
            border: none !important;
            border-radius: 0 !important;
            box-sizing: border-box !important;
            display: grid !important;
            grid-template-columns: 22mm 1fr !important;
            grid-template-rows: auto auto 1fr !important;
            grid-template-areas:
              "model model"
              "lote lote"
              "qr barcode" !important;
            column-gap: 0.5mm !important;
            row-gap: 0 !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .sticker-label:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          /* Zone A: Model + Storage */
          .sticker-label > div:first-child {
            grid-area: model !important;
            display: flex !important;
            align-items: baseline !important;
            gap: 1mm !important;
            margin: 0 !important;
            min-width: 0 !important;
          }

          .sticker-label > div:first-child > p {
            font-size: 3.5mm !important;
            font-weight: bold !important;
            line-height: 1 !important;
            margin: 0 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          .sticker-label > div:first-child > span {
            font-size: 2.3mm !important;
          }

          /* Lote text */
          .sticker-label > p:first-of-type {
            grid-area: lote !important;
            font-size: 2mm !important;
            margin: 0 !important;
            line-height: 1 !important;
            color: #666 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          /* Zone B: QR code */
          .sticker-label > div:nth-child(3) {
            grid-area: qr !important;
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .sticker-label > div:nth-child(3) > svg {
            width: 22mm !important;
            height: 22mm !important;
          }

          /* Zone C: Barcode */
          .sticker-label > div:nth-child(4) {
            grid-area: barcode !important;
            margin: 0 !important;
            padding: 0 0 0 0.5mm !important;
            text-align: center !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            min-width: 0 !important;
          }

          .sticker-label > div:nth-child(4) > svg {
            width: 100% !important;
            height: auto !important;
            max-height: 16mm !important;
          }

          .sticker-label > div:nth-child(4) > p {
            font-size: 2mm !important;
            font-weight: bold !important;
            letter-spacing: 0.03em !important;
            margin: 0.2mm 0 0 !important;
            line-height: 1 !important;
            white-space: nowrap !important;
          }

          /* Counter — hide on small stickers */
          .sticker-label > p:last-child {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
