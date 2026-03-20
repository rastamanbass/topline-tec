import { useRef, useState, useCallback, useEffect } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useSalesStore } from '../../sales/stores/salesStore';
import { phoneLabel } from '../../../lib/phoneUtils';
import toast from 'react-hot-toast';
import { ScanBarcode, Loader2 } from 'lucide-react';
import type { Phone } from '../../../types';

/**
 * ScanToSell — Barcode scanner input for quick selling.
 * The barcode gun acts as an HID keyboard and types the IMEI very fast,
 * then sends Enter. This component captures that input and auto-adds the
 * phone to the cart if it's "En Stock (Disponible para Venta)".
 */
export default function ScanToSell() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imeiInput, setImeiInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { addToCart, openPaymentModal, cartItems } = useSalesStore();

  // Keep focus on the input so the scanner always works
  useEffect(() => {
    const interval = setInterval(() => {
      if (
        inputRef.current &&
        document.activeElement !== inputRef.current &&
        !document.querySelector('[role="dialog"]')
      ) {
        inputRef.current.focus();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const lookupAndSell = useCallback(
    async (rawImei: string) => {
      const digits = rawImei.replace(/\D/g, '');
      // GS1 normalization: 16 digits starting with '1' → strip leading '1'
      const imei = digits.length === 16 && digits[0] === '1' ? digits.slice(1) : digits;

      if (imei.length < 14 || imei.length > 15) {
        toast.error('IMEI inválido — debe tener 15 dígitos');
        return;
      }

      // Check if already in cart — read fresh state to avoid stale closure
      const currentCart = useSalesStore.getState().cartItems;
      if (currentCart.some((item) => item.imei === imei)) {
        toast('Este teléfono ya está en el carrito', { icon: '⚠️' });
        return;
      }

      setIsSearching(true);
      try {
        const q = query(collection(db, 'phones'), where('imei', '==', imei), limit(1));
        const snap = await getDocs(q);

        if (snap.empty) {
          toast.error(`No se encontró teléfono con IMEI ${imei}`);
          return;
        }

        const doc = snap.docs[0];
        const phone = { id: doc.id, ...doc.data() } as Phone;

        if (phone.estado !== 'En Stock (Disponible para Venta)') {
          toast.error(`Este teléfono no está disponible — Estado: ${phone.estado}`);
          return;
        }

        if (
          phone.reservation &&
          phone.reservation.reservedBy === 'POS_SALE' &&
          phone.reservation.expiresAt > Date.now()
        ) {
          toast.error('Este teléfono está reservado en otro proceso de venta');
          return;
        }

        addToCart({
          id: phone.id,
          phoneId: phone.id,
          imei: phone.imei,
          description: phoneLabel(phone.marca, phone.modelo),
          price: phone.precioVenta,
          quantity: 1,
          type: 'phone',
        });

        toast.success(`${phoneLabel(phone.marca, phone.modelo)} — $${phone.precioVenta}`, {
          duration: 2000,
        });

        // Auto-open payment modal on first item — use getState() to avoid stale closure
        if (useSalesStore.getState().cartItems.length === 0) {
          openPaymentModal();
        }
      } catch (err) {
        console.error('ScanToSell lookup error:', err);
        toast.error('Error al buscar el teléfono');
      } finally {
        setIsSearching(false);
      }
    },
    [addToCart, openPaymentModal]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && imeiInput.trim()) {
      e.preventDefault();
      const value = imeiInput.trim();
      setImeiInput('');
      lookupAndSell(value);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
      <ScanBarcode className="w-5 h-5 text-green-600 shrink-0" />
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={imeiInput}
          onChange={(e) => setImeiInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-white border border-green-300 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500"
          placeholder="Escanear IMEI para vender..."
          autoComplete="off"
          disabled={isSearching}
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <Loader2 className="w-4 h-4 animate-spin text-green-600" />
          </div>
        )}
      </div>
      {cartItems.length > 0 && (
        <button
          onClick={openPaymentModal}
          className="shrink-0 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          Carrito ({cartItems.length})
        </button>
      )}
    </div>
  );
}
