import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Check,
  AlertTriangle,
  ScanBarcode,
  Trash2,
  CheckCircle,
  Settings,
  Box,
  DollarSign,
  Tag,
} from 'lucide-react';
import { fetchDeviceFromProxy } from '../services/proxyService';
import { getDeviceDefinition, saveDeviceDefinition } from '../services/deviceService';
import { deviceCatalog } from '../../../data/deviceCatalog';
import toast from 'react-hot-toast';
import { useBatches } from '../hooks/useBatches';
import BatchManager from './BatchManager';
import PrintGateOverlay from './PrintGateOverlay';
import { useAuth } from '../../../context';
import { canViewCosts } from '../../../lib/permissions';
import GlassCard from '../../../components/ui/GlassCard';
import SupplierPicker from '../../../components/ui/SupplierPicker';
import {
  splitMarcaAndSupplier,
  normalizeDisplayBrand,
  normalizeStorage,
  normalizeIPhoneModel,
} from '../../../lib/phoneUtils';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import { useQueryClient } from '@tanstack/react-query';

const PRINT_GATE_SIZE = 10;

interface ScannedItem {
  tempId: string;
  imei: string;
  brand: string;
  model: string;
  storage: string;
  theftStatus: string;
  status: 'pending' | 'success' | 'unknown' | 'error';
  cost: number;
  price: number;
  supplierCode?: string | null; // per-row override; null = use batch/split fallback
  saved?: boolean; // true once saved to Firestore
  firestoreId?: string; // Firestore doc ID once saved
  syncing?: boolean; // true while pushing an update to Firestore
}

interface SavedInCycleEntry {
  imei: string;
  firestoreId: string;
}

interface ScannerViewProps {
  onSuccess: () => void;
  initialBatch?: string | null;
  onCancel?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ScannerView({ onSuccess, initialBatch }: ScannerViewProps) {
  const { user, userRole } = useAuth();
  const showCosts = useMemo(() => canViewCosts(user?.email), [user?.email]);
  const { batches } = useBatches();
  const queryClient = useQueryClient();
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [inputBuffer, setInputBuffer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce timers per item — prevents hammering Firestore on every keystroke
  const updateTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Auto-save + print gate state
  const [savedInCycle, setSavedInCycle] = useState<SavedInCycleEntry[]>([]);
  const [showPrintGate, setShowPrintGate] = useState(false);

  // Batch Management
  const [showBatchManager, setShowBatchManager] = useState(false);
  const [batchLot, setBatchLot] = useState<string>(initialBatch || '');
  const [batchCost, setBatchCost] = useState<string>('');
  const [batchPrice, setBatchPrice] = useState<string>('');
  const [batchSupplier, setBatchSupplier] = useState<string | null>(null);

  useEffect(() => {
    if (!showPrintGate) {
      inputRef.current?.focus();
    }
  }, [showPrintGate]);

  // Save a single phone to Firestore (no toast — silent auto-save)
  const savePhoneToFirestore = useCallback(
    async (item: ScannedItem): Promise<string> => {
      const splitResult = splitMarcaAndSupplier(item.brand, item.model);
      const finalMarca = splitResult.marca;
      const finalSupplierCode =
        item.supplierCode || splitResult.supplierCode || batchSupplier || null;
      const cost = batchCost ? parseFloat(batchCost) : item.cost;
      const price = batchPrice ? parseFloat(batchPrice) : item.price;
      // Admins → En Tránsito (Marta ve realtime). Otros roles → En Stock directo.
      const estado =
        userRole === 'admin' ? 'En Tránsito (a El Salvador)' : 'En Stock (Disponible para Venta)';

      // Save TAC definition (fire and forget)
      if (item.imei && item.imei.length >= 8) {
        const tac = item.imei.substring(0, 8);
        saveDeviceDefinition(tac, finalMarca, item.model);
      }

      // Update price catalog (fire and forget)
      if (price > 0 && item.model) {
        const displayBrand = normalizeDisplayBrand(finalMarca);
        const storageVal = normalizeStorage(item.storage);
        const normalizedModel =
          displayBrand === 'Apple'
            ? normalizeIPhoneModel(item.model || '')
            : item.model || 'Unknown';
        const safeId = `${displayBrand}-${normalizedModel}-${storageVal}`
          .replace(/\//g, '-')
          .replace(/\s+/g, '-')
          .toLowerCase();
        setDoc(
          doc(db, 'price_catalog', safeId),
          {
            brand: displayBrand,
            model: item.model,
            storage: storageVal,
            averagePrice: price,
            lastUpdated: new Date(),
            source: 'auto',
          },
          { merge: true }
        ).catch((err) => console.error('Failed to learn price', err));
      }

      const docRef = await addDoc(collection(db, 'phones'), {
        imei: item.imei,
        marca: finalMarca,
        supplierCode: finalSupplierCode,
        modelo: item.model,
        storage: item.storage,
        costo: cost,
        precioVenta: price,
        lote: batchLot,
        estado,
        condition: 'Grade A',
        fechaIngreso: new Date().toISOString(),
        createdBy: auth.currentUser?.uid,
        updatedAt: serverTimestamp(),
        statusHistory: [
          {
            newStatus: estado,
            date: new Date().toISOString(),
            user: auth.currentUser?.email || 'unknown',
            details: 'Telefono creado (auto-save)',
          },
        ],
      });

      // Invalidate queries so inventory list refreshes
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      queryClient.invalidateQueries({ queryKey: ['phones-paginated'] });

      return docRef.id;
    },
    [batchCost, batchPrice, batchLot, batchSupplier, userRole, queryClient]
  );

  // Track a saved phone in the current cycle and check gate
  const trackSavedPhone = useCallback((imei: string, firestoreId: string) => {
    setSavedInCycle((prev) => {
      const next = [...prev, { imei, firestoreId }];
      if (next.length >= PRINT_GATE_SIZE) {
        setShowPrintGate(true);
      }
      return next;
    });
  }, []);

  // Called when user finishes printing and clicks "Continuar Escaneando"
  const handlePrintGateComplete = useCallback(() => {
    setSavedInCycle([]);
    setShowPrintGate(false);
    // Remove saved items from the scanned list (they're already in Firestore)
    setScannedItems((prev) => prev.filter((item) => !item.saved));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const processImei = async (imei: string) => {
    if (!imei || imei.length < 8) return;
    if (scannedItems.some((item) => item.imei === imei)) {
      toast.error('IMEI ya escaneado');
      return;
    }

    const tempId = Math.random().toString(36).substr(2, 9);
    const newItem: ScannedItem = {
      tempId,
      imei,
      brand: '',
      model: '',
      storage: '',
      theftStatus: 'UNKNOWN',
      status: 'pending',
      cost: 0,
      price: 0,
    };

    setScannedItems((prev) => [newItem, ...prev]);

    try {
      // Normalize GS1 artifact: scanners may prepend '1' on 16-digit GS1-128 barcodes
      const imeiDigits = imei.replace(/\D/g, '');
      const normalizedImei =
        imeiDigits.length === 16 && imeiDigits[0] === '1' ? imeiDigits.slice(1) : imeiDigits;

      // Warn Eduardo about short IMEIs
      if (normalizedImei.length < 15) {
        setScannedItems((prev) =>
          prev.map((item) =>
            item.tempId === tempId
              ? { ...item, status: 'error' as const, theftStatus: 'SHORT_IMEI' }
              : item
          )
        );
        toast.error(
          `IMEI incompleto: solo ${normalizedImei.length} dígitos. Brother, por favor meter el IMEI completo (15 dígitos).`,
          { duration: 5000 }
        );
        return;
      }

      const uniqueTac = normalizedImei.substring(0, 8);
      let def = await getDeviceDefinition(uniqueTac);

      if (!def) {
        const proxy = await fetchDeviceFromProxy(normalizedImei);
        if (proxy) {
          def = {
            brand: proxy.brand,
            model: proxy.model,
            storage: proxy.storage,
            updatedAt: Date.now(),
          } as { brand: string; model: string; storage?: string; updatedAt: number };
        }
      }

      if (def && def.model) {
        // EMERGENCY SANITIZER: Clean "bad cache" from previous runs
        // If the DB has "iPhone IM", we strip it here before displaying.
        const badSuffixes = [' IM', ' Check', ' Specs', ' IMEI'];
        let cleanModel = def.model;
        badSuffixes.forEach((s) => {
          if (cleanModel.endsWith(s)) {
            cleanModel = cleanModel.replace(s, '');
          }
        });

        // If we just stripped it down to "iPhone ", try to keep it reasonable
        if (cleanModel.trim() === 'iPhone') cleanModel = 'iPhone (Model Unknown)';

        def.model = cleanModel;
      }

      if (def) {
        // Apply current batchCost/batchPrice to the item so UI reflects what was saved
        const appliedCost = batchCost ? parseFloat(batchCost) : newItem.cost;
        const appliedPrice = batchPrice ? parseFloat(batchPrice) : newItem.price;

        const resolvedItem: ScannedItem = {
          ...newItem,
          brand: def.brand,
          model: def.model,
          storage:
            (def as { brand: string; model: string; storage?: string; updatedAt: number })
              .storage || newItem.storage,
          theftStatus: 'UNKNOWN',
          status: 'success',
          cost: appliedCost,
          price: appliedPrice,
        };

        setScannedItems((prev) =>
          prev.map((item) => (item.tempId === tempId ? { ...resolvedItem, saved: false } : item))
        );

        // Check Firestore for duplicate IMEI before saving
        const dupeQuery = query(
          collection(db, 'phones'),
          where('imei', '==', normalizedImei),
          firestoreLimit(1)
        );
        const dupeSnap = await getDocs(dupeQuery);
        if (!dupeSnap.empty) {
          setScannedItems((prev) =>
            prev.map((item) =>
              item.tempId === tempId
                ? { ...item, status: 'error' as const, theftStatus: 'DUPLICATE_DB' }
                : item
            )
          );
          toast.error(`IMEI ${normalizedImei} ya existe en el sistema`, { duration: 5000 });
          return;
        }

        // Use normalized IMEI for saving
        resolvedItem.imei = normalizedImei;

        // Auto-save to Firestore immediately
        try {
          const firestoreId = await savePhoneToFirestore(resolvedItem);
          setScannedItems((prev) =>
            prev.map((item) =>
              item.tempId === tempId ? { ...item, saved: true, firestoreId } : item
            )
          );
          trackSavedPhone(resolvedItem.imei, firestoreId);
        } catch (saveErr) {
          console.error('Auto-save failed:', saveErr);
          toast.error(`Error guardando ${resolvedItem.imei}`);
        }
      } else {
        setScannedItems((prev) =>
          prev.map((item) =>
            item.tempId === tempId ? { ...item, theftStatus: 'UNKNOWN', status: 'unknown' } : item
          )
        );
      }
    } catch (e) {
      console.error(e);
      setScannedItems((prev) =>
        prev.map((item) => (item.tempId === tempId ? { ...item, status: 'error' } : item))
      );
    }
  };

  const processInput = async (rawInput: string) => {
    const candidates = rawInput
      .split(/[\n, ]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 8);
    if (candidates.length === 0) return;

    for (const imei of candidates) {
      await processImei(imei);
    }
    setInputBuffer('');
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await processInput(inputBuffer);
    }
  };

  const handleRemove = (id: string) => {
    setScannedItems((prev) => prev.filter((i) => i.tempId !== id));
  };

  // Push a single field update to Firestore (debounced per item to avoid spam)
  const pushUpdateToFirestore = useCallback(
    (firestoreId: string, tempId: string, updates: Record<string, unknown>) => {
      const existing = updateTimersRef.current.get(tempId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        try {
          setScannedItems((prev) =>
            prev.map((i) => (i.tempId === tempId ? { ...i, syncing: true } : i))
          );
          await updateDoc(doc(db, 'phones', firestoreId), {
            ...updates,
            updatedAt: serverTimestamp(),
          });
          setScannedItems((prev) =>
            prev.map((i) => (i.tempId === tempId ? { ...i, syncing: false } : i))
          );
          queryClient.invalidateQueries({ queryKey: ['phones'] });
          queryClient.invalidateQueries({ queryKey: ['phones-paginated'] });
        } catch (err) {
          console.error('Failed to sync field update:', err);
          setScannedItems((prev) =>
            prev.map((i) => (i.tempId === tempId ? { ...i, syncing: false } : i))
          );
          toast.error('Error sincronizando cambio');
        }
      }, 600);

      updateTimersRef.current.set(tempId, timer);
    },
    [queryClient]
  );

  const handleUpdateItem = (
    id: string,
    field: keyof ScannedItem,
    value: string | number | null
  ) => {
    setScannedItems((prev) => {
      const next = prev.map((item) => (item.tempId === id ? { ...item, [field]: value } : item));

      const updatedItem = next.find((i) => i.tempId === id);

      // SMART LEARNING: If Brand+Model are filled, save to local DB
      if (updatedItem && (field === 'brand' || field === 'model')) {
        if (updatedItem.brand && updatedItem.model && updatedItem.imei.length >= 8) {
          const tac = updatedItem.imei.substring(0, 8);
          saveDeviceDefinition(tac, updatedItem.brand, updatedItem.model);
        }
      }

      // If already saved to Firestore, propagate the change there
      if (updatedItem?.firestoreId) {
        const firestoreField =
          field === 'cost'
            ? 'costo'
            : field === 'price'
              ? 'precioVenta'
              : field === 'brand'
                ? 'marca'
                : field === 'model'
                  ? 'modelo'
                  : field === 'storage'
                    ? 'storage'
                    : field === 'supplierCode'
                      ? 'supplierCode'
                      : null;

        if (firestoreField) {
          pushUpdateToFirestore(updatedItem.firestoreId, id, {
            [firestoreField]: value,
          });
        }
      }

      return next;
    });
  };

  // Cleanup debounce timers on unmount
  useEffect(() => {
    const timers = updateTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const applyBatch = () => {
    if (!batchCost && !batchPrice && !batchSupplier) return;

    const newCost = batchCost ? parseFloat(batchCost) : null;
    const newPrice = batchPrice ? parseFloat(batchPrice) : null;
    const newSupplier = batchSupplier || null;

    setScannedItems((prev) => {
      const next = prev.map((item) => ({
        ...item,
        cost: newCost !== null ? newCost : item.cost,
        price: newPrice !== null ? newPrice : item.price,
        // Solo aplicar supplier batch si el item NO tiene su propio override
        supplierCode: newSupplier && !item.supplierCode ? newSupplier : item.supplierCode,
      }));

      // Push updates to Firestore for already-saved items
      next.forEach((item) => {
        if (item.firestoreId) {
          const updates: Record<string, unknown> = {};
          if (newCost !== null) updates.costo = newCost;
          if (newPrice !== null) updates.precioVenta = newPrice;
          // Solo persiste si el item efectivamente recibio el supplier del batch
          if (newSupplier && item.supplierCode === newSupplier) {
            updates.supplierCode = newSupplier;
          }
          if (Object.keys(updates).length > 0) {
            pushUpdateToFirestore(item.firestoreId, item.tempId, updates);
          }
        }
      });

      return next;
    });

    toast.success('Lote aplicado');
  };

  // Manual save for 'unknown' items after user fills brand+model
  const handleManualSave = async (tempId: string) => {
    const item = scannedItems.find((i) => i.tempId === tempId);
    if (!item) return;
    if (!item.brand || !item.model) {
      toast.error('Llena marca y modelo antes de guardar');
      return;
    }

    try {
      const firestoreId = await savePhoneToFirestore(item);
      setScannedItems((prev) =>
        prev.map((i) =>
          i.tempId === tempId ? { ...i, saved: true, status: 'success', firestoreId } : i
        )
      );
      trackSavedPhone(item.imei, firestoreId);
    } catch (err) {
      console.error('Manual save failed:', err);
      toast.error(`Error guardando ${item.imei}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Top Bar: Gun Input - Floating Glass Effect */}
      <div className="p-6 pb-0 z-20">
        <GlassCard className="p-6 bg-slate-900/95 border-slate-700 text-white shadow-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <ScanBarcode className="w-8 h-8 text-green-400 animate-pulse-slow" />
            </div>
            <div>
              <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Escáner Activo
              </h3>
              <p className="text-slate-400 text-sm">Listo para escanear IMEIs</p>
            </div>
          </div>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputBuffer}
              onChange={(e) => setInputBuffer(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={showPrintGate}
              className="w-full bg-slate-800/50 border border-slate-600 text-white text-3xl p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono transition-all placeholder:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              placeholder={showPrintGate ? 'Imprime stickers para continuar...' : 'Escanea aqui...'}
              autoComplete="off"
              autoFocus
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
              {savedInCycle.length}/{PRINT_GATE_SIZE} en ciclo
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Batch Toolbar */}
      <div className="p-6 py-4 flex gap-4 overflow-x-auto z-10 shrink-0">
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200">
          <Box className="w-4 h-4 text-slate-400" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Lote</span>
            <div className="flex items-center gap-1">
              <input
                value={batchLot}
                onChange={(e) => setBatchLot(e.target.value)}
                placeholder="Lote General"
                className="text-sm font-semibold text-slate-700 outline-none w-24 bg-transparent placeholder:text-slate-300"
                list="existing-batches"
              />
              {user?.role === 'admin' && (
                <button
                  onClick={() => setShowBatchManager(true)}
                  className="text-slate-300 hover:text-primary-600"
                >
                  <Settings className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {showCosts && (
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Costo (Todos)</span>
              <input
                type="number"
                value={batchCost}
                onChange={(e) => setBatchCost(e.target.value)}
                placeholder="0.00"
                className="text-sm font-semibold text-slate-700 outline-none w-20 bg-transparent placeholder:text-slate-300"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200">
          <Tag className="w-4 h-4 text-slate-400" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Venta (Todos)</span>
            <input
              type="number"
              value={batchPrice}
              onChange={(e) => setBatchPrice(e.target.value)}
              placeholder="0.00"
              className="text-sm font-semibold text-slate-700 outline-none w-20 bg-transparent placeholder:text-slate-300"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200">
          <Tag className="w-4 h-4 text-amber-400" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Proveedor (Todos)
            </span>
            <div className="min-w-[10rem]">
              <SupplierPicker
                value={batchSupplier}
                onChange={setBatchSupplier}
                size="sm"
                placeholder="WNY, KRA..."
              />
            </div>
          </div>
        </div>

        <button
          onClick={applyBatch}
          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg text-sm font-bold transition-colors"
        >
          Aplicar
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-24">
        {scannedItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300">
            <ScanBarcode className="w-24 h-24 mb-4 opacity-20" />
            <p className="text-xl font-medium">Lista vacía</p>
            <p className="text-sm">Tus dispositivos escaneados aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scannedItems.map((item) => (
              <div
                key={item.tempId}
                className={`relative group bg-white p-4 rounded-xl shadow-sm border transition-all ${
                  item.status === 'unknown'
                    ? 'border-amber-200 bg-amber-50/30'
                    : item.status === 'error'
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-slate-100'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div
                    className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      item.saved
                        ? 'bg-emerald-100 text-emerald-600'
                        : item.status === 'success'
                          ? 'bg-green-100 text-green-600'
                          : item.status === 'unknown'
                            ? 'bg-amber-100 text-amber-600'
                            : item.status === 'pending'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {item.status === 'pending' || item.syncing ? (
                      <span className="animate-spin">⏳</span>
                    ) : item.saved ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : item.status === 'success' ? (
                      <Check className="w-4 h-4" />
                    ) : item.status === 'unknown' ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                        IMEI
                      </p>
                      <p
                        className="font-mono font-bold text-slate-700 text-sm truncate"
                        title={item.imei}
                      >
                        {item.imei}
                      </p>
                    </div>

                    <div className="md:col-span-3">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                        <span>MARCA / MODELO</span>
                        {(item.supplierCode || batchSupplier) && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wide"
                            title={`Proveedor: ${item.supplierCode || batchSupplier}`}
                          >
                            {item.supplierCode || batchSupplier}
                          </span>
                        )}
                      </p>
                      <div className="flex gap-3">
                        <input
                          value={item.brand}
                          onChange={(e) => handleUpdateItem(item.tempId, 'brand', e.target.value)}
                          placeholder="Marca"
                          className="w-1/3 bg-transparent border-b border-slate-200 focus:border-primary-500 outline-none text-sm font-medium placeholder:text-slate-300"
                          list="brands-list-manual"
                        />
                        <input
                          value={item.model}
                          onChange={(e) => handleUpdateItem(item.tempId, 'model', e.target.value)}
                          placeholder="Modelo detectado..."
                          className="w-2/3 bg-transparent border-b border-slate-200 focus:border-primary-500 outline-none text-sm font-bold text-slate-900 placeholder:text-slate-300"
                          list="models-list-manual"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2 flex flex-col items-start">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                        Proveedor
                      </p>
                      <SupplierPicker
                        value={item.supplierCode || null}
                        onChange={(c) => handleUpdateItem(item.tempId, 'supplierCode', c)}
                        size="sm"
                        placeholder="—"
                      />
                    </div>

                    {/* Storage (GB) */}
                    <div className="md:col-span-1 flex flex-col items-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 text-center w-full">
                        GB
                      </p>
                      <input
                        value={item.storage}
                        onChange={(e) => handleUpdateItem(item.tempId, 'storage', e.target.value)}
                        placeholder="-"
                        className="bg-transparent border-b border-slate-200 focus:border-primary-500 outline-none w-16 font-mono text-sm font-bold text-slate-600 text-center placeholder:text-slate-300"
                      />
                    </div>

                    {showCosts && (
                      <div className="md:col-span-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          COSTO
                        </p>
                        <div className="flex items-center text-slate-500">
                          <span className="text-xs mr-1">$</span>
                          <input
                            type="number"
                            value={item.cost || ''}
                            onChange={(e) =>
                              handleUpdateItem(item.tempId, 'cost', parseFloat(e.target.value))
                            }
                            className="bg-transparent border-b border-slate-200 focus:border-primary-500 outline-none w-full font-mono text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    )}

                    <div className="md:col-span-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                        VENTA
                      </p>
                      <div className="flex items-center text-primary-600 font-bold">
                        <span className="text-xs mr-1">$</span>
                        <input
                          type="number"
                          value={item.price || ''}
                          onChange={(e) =>
                            handleUpdateItem(item.tempId, 'price', parseFloat(e.target.value))
                          }
                          className="bg-transparent border-b border-slate-200 focus:border-primary-500 outline-none w-full font-mono text-sm"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-1 flex flex-col items-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 text-center w-full">
                        ESTATUS
                      </p>
                      <div className="flex items-center justify-center h-8">
                        {item.theftStatus === 'UNKNOWN' ? (
                          <span
                            className="px-2 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200"
                            title="No verificado — sin API de robo conectada"
                          >
                            NO VERIF.
                          </span>
                        ) : item.theftStatus === 'CLEAN' ? (
                          <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            CLEAN
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold border border-red-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> RISK
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-1 flex justify-end gap-1">
                      {/* Manual save button for 'unknown' items with brand+model filled */}
                      {item.status === 'unknown' && item.brand && item.model && !item.saved && (
                        <button
                          onClick={() => handleManualSave(item.tempId)}
                          className="p-2 text-green-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                          title="Guardar manualmente"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {!item.saved && (
                        <button
                          onClick={() => handleRemove(item.tempId)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Print Gate Overlay */}
      {showPrintGate && (
        <PrintGateOverlay
          imeis={savedInCycle.map((s) => s.imei)}
          onComplete={handlePrintGateComplete}
        />
      )}

      <datalist id="brands-list-manual">
        {Array.from(new Set(deviceCatalog.map((d) => d.brand)))
          .sort()
          .map((brand) => (
            <option key={brand} value={brand} />
          ))}
      </datalist>
      <datalist id="models-list-manual">
        {deviceCatalog.map((d) => (
          <option key={`${d.brand}-${d.model}`} value={d.model}>
            {d.brand}
          </option>
        ))}
      </datalist>
      <datalist id="existing-batches">
        {batches.map((b) => (
          <option key={b.id} value={b.name} />
        ))}
      </datalist>
      {showBatchManager && <BatchManager onClose={() => setShowBatchManager(false)} />}
    </div>
  );
}
