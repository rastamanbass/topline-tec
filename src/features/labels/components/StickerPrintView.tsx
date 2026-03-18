import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import PhoneStickerLabel from './PhoneStickerLabel';
import { Printer } from 'lucide-react';
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

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando teléfonos...</div>;
  }

  return (
    <div>
      <div className="print:hidden bg-gray-100 p-4 text-center space-y-2 sticky top-0 z-10">
        <p className="text-lg font-bold">
          {phones.length} sticker{phones.length !== 1 ? 's' : ''} — {lote || imei}
        </p>
        <button
          onClick={() => window.print()}
          className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-xl font-semibold inline-flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Imprimir
        </button>
      </div>

      <div className="flex flex-wrap gap-2 p-4 justify-center print:gap-0 print:p-0">
        {phones.map((phone, i) => (
          <PhoneStickerLabel key={phone.id} phone={phone} index={i} total={phones.length} />
        ))}
      </div>

      <style>{`
        @media print {
          @page { margin: 0mm; size: 40mm 30mm; }
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:gap-0 { gap: 0 !important; }
          .print\\:p-0 { padding: 0 !important; }
          .page-break-after-always { page-break-after: always; }
          .page-break-after-always:last-child { page-break-after: auto; }
        }
      `}</style>
    </div>
  );
}
