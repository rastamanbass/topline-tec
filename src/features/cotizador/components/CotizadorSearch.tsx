import { useState, useRef, useEffect, useCallback } from 'react';
import { ScanBarcode, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useCotizador } from '../hooks/useCotizador';

// GS1 normalization: 16-digit IMEI starting with '1' → strip leading '1'
function normalizeImei(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 16 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

export default function CotizadorSearch() {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addItem = useCotizador((s) => s.addItem);

  // Keep input focused
  const refocus = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = useCallback(
    async (rawValue: string) => {
      const imei = normalizeImei(rawValue);
      if (imei.length < 14) {
        toast.error('IMEI inválido — mínimo 14 dígitos');
        setInputValue('');
        refocus();
        return;
      }

      setIsLoading(true);
      try {
        const q = query(collection(db, 'phones'), where('imei', '==', imei), limit(1));
        const snap = await getDocs(q);

        if (snap.empty) {
          toast.error(`IMEI ${imei} no encontrado en inventario`);
          setInputValue('');
          refocus();
          return;
        }

        const doc = snap.docs[0];
        const data = doc.data();

        if (data.seized) {
          toast.error('Este equipo está retenido (CECOT)');
          setInputValue('');
          refocus();
          return;
        }

        if (data.estado !== 'En Stock (Disponible para Venta)') {
          toast.error(`Estado actual: "${data.estado}" — no disponible para cotizar`);
          setInputValue('');
          refocus();
          return;
        }

        const added = addItem({
          phoneId: doc.id,
          imei,
          marca: data.marca ?? '',
          modelo: data.modelo ?? '',
          storage: data.storage,
          precio: data.precioVenta ?? 0,
          addedAt: Date.now(),
        });

        if (!added) {
          toast.error('Este IMEI ya está en la cotización');
        } else {
          toast.success(`${data.marca} ${data.modelo} agregado`);
        }
      } catch (err) {
        console.error('CotizadorSearch error:', err);
        toast.error('Error al buscar el equipo');
      } finally {
        setIsLoading(false);
        setInputValue('');
        refocus();
      }
    },
    [addItem, refocus]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      handleScan(inputValue.trim());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      handleScan(inputValue.trim());
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <ScanBarcode className="w-5 h-5 text-cyan-400" />
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Escanear IMEI
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          aria-label="Escanear o ingresar IMEI"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escanea o escribe el IMEI…"
          disabled={isLoading}
          className="flex-1 bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-xl px-4 py-3 font-mono tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl transition-colors flex items-center gap-2"
          aria-label="Agregar equipo"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
}
