import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Printer, ArrowRight, RotateCcw, Download } from 'lucide-react';
import { openStickersPDF, downloadStickersPDF } from '../../labels/utils/stickerPdfGenerator';
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
    if (phones.length === 0) return;
    openStickersPDF(phones);
    setHasPrinted(true);
  };

  const handleDownload = () => {
    if (phones.length === 0) return;
    downloadStickersPDF(phones, `stickers-${Date.now()}.pdf`);
    setHasPrinted(true);
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
                Abrir PDF para Imprimir
              </button>
              <button
                onClick={handleDownload}
                disabled={isLoading || phones.length === 0}
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-2 rounded-xl font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Descargar PDF
              </button>
              <p className="text-xs text-slate-400 text-center">
                PDF a 40×30mm. Imprimir desde Adobe/Jadens app con tamaño 40×30mm.
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
    </div>
  );
}
