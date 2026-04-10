import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import PhoneStickerLabel from '../../labels/components/PhoneStickerLabel';
import { Printer, ArrowRight, RotateCcw } from 'lucide-react';
import type { Phone } from '../../../types';

interface PrintGateOverlayProps {
  imeis: string[];
  onComplete: () => void;
}

export default function PrintGateOverlay({ imeis, onComplete }: PrintGateOverlayProps) {
  const [hasPrinted, setHasPrinted] = useState(false);

  const { data: phones = [], isLoading } = useQuery({
    queryKey: ['print-gate-phones', imeis],
    queryFn: async () => {
      if (imeis.length === 0) return [];
      const q = query(collection(db, 'phones'), where('imei', 'in', imeis));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Phone);
    },
    enabled: imeis.length > 0,
  });

  const handlePrint = () => {
    setHasPrinted(true);
    window.print();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm no-print-overlay">
      {/* On-screen modal */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6 no-print">
        <h2 className="text-xl font-bold text-slate-900 mb-1">10 telefonos listos para imprimir</h2>
        <p className="text-sm text-slate-500 mb-4">
          Imprime los stickers antes de continuar escaneando.
        </p>

        {isLoading ? (
          <div className="text-center py-8 text-slate-400">Cargando telefonos...</div>
        ) : (
          <div className="max-h-64 overflow-y-auto mb-4 border border-slate-100 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">#</th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">IMEI</th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Marca</th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Modelo</th>
                </tr>
              </thead>
              <tbody>
                {phones.map((phone, i) => (
                  <tr key={phone.id} className="border-t border-slate-50">
                    <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{phone.imei}</td>
                    <td className="px-3 py-1.5">{phone.marca}</td>
                    <td className="px-3 py-1.5 font-medium">{phone.modelo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {!hasPrinted ? (
            <>
              <button
                onClick={handlePrint}
                disabled={isLoading || phones.length === 0}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2 text-lg disabled:opacity-50 transition-colors"
              >
                <Printer className="w-5 h-5" />
                Imprimir {phones.length} Stickers
              </button>
              <p className="text-xs text-slate-400 text-center">
                Papel 40×60mm · Margenes: ninguno · Escala: 100%
              </p>
              <button
                onClick={onComplete}
                className="w-full text-slate-400 hover:text-slate-600 text-sm py-2 transition-colors"
              >
                Saltar impresion (imprimir despues desde lote)
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handlePrint}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reimprimir
              </button>
              <button
                onClick={onComplete}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2 text-lg transition-colors"
              >
                Continuar Escaneando
                <ArrowRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Print-only area: sticker labels - use absolute positioning off-screen instead of hidden,
           because JsBarcode needs the SVG elements to be in the layout to render barcodes */}
      <div className="print-area" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        {phones.map((phone, i) => (
          <PhoneStickerLabel key={phone.id} phone={phone} index={i} total={phones.length} />
        ))}
      </div>

      <style>{`
        @media print {
          @page {
            size: 30mm 20mm;
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

          .no-print, .no-print-overlay, nav, header, footer {
            display: none !important;
          }

          .no-print-overlay > .no-print {
            display: none !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 30mm !important;
          }

          .print-area {
            display: block !important;
            position: static !important;
            left: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            gap: 0 !important;
            width: 30mm !important;
          }

          .sticker-label {
            width: 30mm !important;
            height: 20mm !important;
            max-width: none !important;
            aspect-ratio: auto !important;
            margin: 0 !important;
            padding: 2mm !important;
            border: none !important;
            border-radius: 0 !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: space-between !important;
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
            display: flex !important;
            align-items: baseline !important;
            gap: 1mm !important;
            margin: 0 !important;
            width: 100% !important;
            justify-content: center !important;
          }

          .sticker-label > div:first-child > p {
            font-size: 1.8mm !important;
            font-weight: bold !important;
            line-height: 1 !important;
            margin: 0 !important;
          }

          .sticker-label > div:first-child > span {
            font-size: 1.2mm !important;
          }

          /* Lote text */
          .sticker-label > p:first-of-type {
            font-size: 1mm !important;
            margin: 0.5mm 0 0 !important;
            line-height: 1 !important;
            color: #666 !important;
            text-align: center !important;
            width: 100% !important;
          }

          /* Zone B: QR code */
          .sticker-label > div:nth-child(3) {
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            justify-content: center !important;
          }

          .sticker-label > div:nth-child(3) > svg {
            width: 9mm !important;
            height: 9mm !important;
          }

          /* Zone C: Barcode */
          .sticker-label > div:nth-child(4) {
            margin-top: 0.5mm !important;
            padding: 0 !important;
            text-align: center !important;
            width: 100% !important;
          }

          .sticker-label > div:nth-child(4) > svg {
            width: 95% !important;
            height: auto !important;
            max-height: 5mm !important;
          }

          .sticker-label > div:nth-child(4) > p {
            font-size: 1mm !important;
            font-weight: bold !important;
            letter-spacing: 0.05em !important;
            margin: 0.3mm 0 0 !important;
            line-height: 1 !important;
          }

          /* Counter */
          .sticker-label > p:last-child {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
