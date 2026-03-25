import { useRef, useState, useCallback, useEffect } from 'react';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useSalesStore } from '../../sales/stores/salesStore';
import { phoneLabel, normalizeDisplayBrand } from '../../../lib/phoneUtils';
import toast from 'react-hot-toast';
import { ScanBarcode, Camera, X, Loader2, Search, ShoppingCart, Package } from 'lucide-react';
import BulkSaleDialog from './BulkSaleDialog';
import type { Phone } from '../../../types';

/**
 * Extract IMEI from various scan inputs:
 * - Raw IMEI digits (15 or 14 digits)
 * - GS1 barcode artifact (16 digits starting with '1')
 * - QR code URL: https://inventario-a6aa3.web.app/phone/{IMEI}
 */
function extractImei(raw: string): string | null {
  const trimmed = raw.trim();

  const urlMatch = trimmed.match(/\/phone\/(\d{14,15})(?:\?|$|#)/);
  if (urlMatch) return urlMatch[1];

  try {
    const url = new URL(trimmed);
    const pathMatch = url.pathname.match(/\/phone\/(\d{14,15})$/);
    if (pathMatch) return pathMatch[1];
  } catch {
    // Not a URL
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 16 && digits[0] === '1') return digits.slice(1);
  if (digits.length >= 14 && digits.length <= 15) return digits;
  return null;
}

/**
 * ScanToSell — Barcode scanner + manual search for quick selling.
 * Supports: HID barcode gun, QR code URLs, camera scanning, and text search by model.
 * When input doesn't look like an IMEI, searches available phones by model/brand.
 */
export default function ScanToSell() {
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<unknown>(null);
  const [imeiInput, setImeiInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Phone[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showBulkSale, setShowBulkSale] = useState(false);
  const { addToCart, openPaymentModal, cartItems } = useSalesStore();

  // Keep focus on the input so the scanner always works (only when camera is closed)
  useEffect(() => {
    if (cameraOpen || showResults) return;
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
  }, [cameraOpen, showResults]);

  const addPhoneToCart = useCallback(
    (phone: Phone) => {
      const currentCart = useSalesStore.getState().cartItems;
      if (currentCart.some((item) => item.imei === phone.imei)) {
        toast('Este teléfono ya está en el carrito', { icon: '⚠️' });
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

      // Remove from search results
      setSearchResults((prev) => prev.filter((p) => p.id !== phone.id));

      if (useSalesStore.getState().cartItems.length === 1) {
        openPaymentModal();
      }
    },
    [addToCart, openPaymentModal]
  );

  const lookupAndSell = useCallback(
    async (rawInput: string) => {
      const imei = extractImei(rawInput);

      if (!imei) {
        // Not an IMEI — search by model/brand instead
        const searchText = rawInput.trim();
        if (searchText.length < 2) {
          toast.error('Escribe al menos 2 caracteres para buscar');
          return;
        }

        setIsSearching(true);
        try {
          // Query available phones and filter client-side by model/brand
          const q = query(
            collection(db, 'phones'),
            where('estado', '==', 'En Stock (Disponible para Venta)'),
            orderBy('modelo'),
            limit(200)
          );
          const snap = await getDocs(q);
          const searchLower = searchText.toLowerCase();
          const matches = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Phone)
            .filter(
              (p) =>
                p.modelo.toLowerCase().includes(searchLower) ||
                p.marca.toLowerCase().includes(searchLower) ||
                normalizeDisplayBrand(p.marca).toLowerCase().includes(searchLower) ||
                `${p.marca} ${p.modelo}`.toLowerCase().includes(searchLower)
            )
            .filter((p) => {
              // Exclude phones already in cart
              const currentCart = useSalesStore.getState().cartItems;
              return !currentCart.some((item) => item.imei === p.imei);
            });

          if (matches.length === 0) {
            toast.error(`No hay teléfonos disponibles que coincidan con "${searchText}"`);
            setShowResults(false);
          } else {
            setSearchResults(matches);
            setShowResults(true);
          }
        } catch (err) {
          console.error('Search error:', err);
          toast.error('Error al buscar');
        } finally {
          setIsSearching(false);
        }
        return;
      }

      // It's a valid IMEI — do the normal lookup
      const currentCart = useSalesStore.getState().cartItems;
      if (currentCart.some((item) => item.imei === imei)) {
        toast('Este teléfono ya está en el carrito', { icon: '⚠️' });
        return;
      }

      setIsSearching(true);
      setShowResults(false);
      try {
        const q = query(collection(db, 'phones'), where('imei', '==', imei), limit(1));
        const snap = await getDocs(q);

        if (snap.empty) {
          toast.error(`No se encontró teléfono con IMEI ${imei}`);
          return;
        }

        const d = snap.docs[0];
        const phone = { id: d.id, ...d.data() } as Phone;

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

        addPhoneToCart(phone);
      } catch (err) {
        console.error('ScanToSell lookup error:', err);
        toast.error('Error al buscar el teléfono');
      } finally {
        setIsSearching(false);
      }
    },
    [addPhoneToCart]
  );

  // Camera scanner lifecycle
  const startCamera = useCallback(async () => {
    setCameraOpen(true);
    setShowResults(false);
    await new Promise((r) => setTimeout(r, 100));
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('scan-to-sell-camera', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 300, height: 200 }, aspectRatio: 1.5 },
        (decodedText) => {
          const imei = extractImei(decodedText);
          if (imei) {
            toast('Escaneado con cámara', { icon: '📷' });
            scanner.stop().catch(() => {});
            scannerRef.current = null;
            setCameraOpen(false);
            lookupAndSell(decodedText);
          }
        },
        () => {}
      );
    } catch (err) {
      console.error('Camera scanner error:', err);
      toast.error('No se pudo abrir la cámara');
      setCameraOpen(false);
    }
  }, [lookupAndSell]);

  const stopCamera = useCallback(() => {
    const scanner = scannerRef.current as { stop: () => Promise<void> } | null;
    if (scanner) {
      scanner.stop().catch(() => {});
      scannerRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current as { stop: () => Promise<void> } | null;
      if (scanner) scanner.stop().catch(() => {});
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && imeiInput.trim()) {
      e.preventDefault();
      const value = imeiInput.trim();
      setImeiInput('');
      lookupAndSell(value);
    }
    if (e.key === 'Escape') {
      setShowResults(false);
      setSearchResults([]);
    }
  };

  return (
    <div className="space-y-2">
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
            placeholder="IMEI, QR, o buscar modelo (ej: A36, 13 128gb)..."
            autoComplete="off"
            disabled={isSearching}
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <Loader2 className="w-4 h-4 animate-spin text-green-600" />
            </div>
          )}
        </div>
        <button
          onClick={cameraOpen ? stopCamera : startCamera}
          className={`shrink-0 p-2 rounded-lg transition-colors ${
            cameraOpen
              ? 'bg-red-100 text-red-600 hover:bg-red-200'
              : 'bg-green-100 text-green-600 hover:bg-green-200'
          }`}
          title={cameraOpen ? 'Cerrar cámara' : 'Escanear con cámara'}
        >
          {cameraOpen ? <X className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
        </button>
        <button
          onClick={() => setShowBulkSale(true)}
          className="shrink-0 p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
          title="Venta en Lote"
        >
          <Package className="w-5 h-5" />
        </button>
        {cartItems.length > 0 && (
          <button
            onClick={openPaymentModal}
            className="shrink-0 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            Carrito ({cartItems.length})
          </button>
        )}
      </div>

      {/* Camera view */}
      {cameraOpen && (
        <div className="bg-black rounded-xl overflow-hidden relative">
          <div id="scan-to-sell-camera" className="w-full" />
          <p className="text-center text-white/70 text-xs py-2">
            Apunta al código de barras o QR del sticker
          </p>
        </div>
      )}

      {/* Search results — pick a phone to sell manually */}
      {showResults && searchResults.length > 0 && (
        <div className="bg-white border border-green-200 rounded-xl shadow-lg overflow-hidden max-h-80 overflow-y-auto">
          <div className="px-4 py-2 bg-green-50 border-b border-green-100 flex items-center justify-between sticky top-0">
            <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
              <Search className="w-4 h-4" />
              {searchResults.length} disponibles — toca para agregar al carrito
            </p>
            <button
              onClick={() => {
                setShowResults(false);
                setSearchResults([]);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {searchResults.map((phone) => (
              <button
                key={phone.id}
                onClick={() => addPhoneToCart(phone)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {normalizeDisplayBrand(phone.marca)} {phone.modelo}
                  </p>
                  <p className="text-xs font-mono text-gray-400 truncate">IMEI: {phone.imei}</p>
                </div>
                <span className="text-sm font-bold text-green-700 shrink-0">
                  ${phone.precioVenta}
                </span>
                <ShoppingCart className="w-4 h-4 text-green-500 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Sale Dialog */}
      {showBulkSale && <BulkSaleDialog onClose={() => setShowBulkSale(false)} />}
    </div>
  );
}
