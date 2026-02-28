import { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  AlertTriangle,
  ScanBarcode,
  Trash2,
  Play,
  Settings,
  Box,
  DollarSign,
  Tag,
} from 'lucide-react';
import { useCreatePhone } from '../hooks/usePhones';
import { fetchDeviceFromProxy } from '../services/proxyService';
import { getDeviceDefinition, saveDeviceDefinition } from '../services/deviceService';
import { deviceCatalog } from '../../../data/deviceCatalog';
import toast from 'react-hot-toast';
import { useBatches } from '../hooks/useBatches';
import BatchManager from './BatchManager';
import { useAuth } from '../../../context';
import GlassCard from '../../../components/ui/GlassCard';

// ... interface update
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
}

interface ScannerViewProps {
  onSuccess: () => void;
  initialBatch?: string | null;
  onCancel?: () => void;
}

export default function ScannerView({ onSuccess, initialBatch }: ScannerViewProps) {
  const { user } = useAuth();
  const { batches } = useBatches();
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [inputBuffer, setInputBuffer] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const createPhone = useCreatePhone();

  // Batch Management
  const [showBatchManager, setShowBatchManager] = useState(false);
  const [batchLot, setBatchLot] = useState<string>(initialBatch || '');
  const [batchCost, setBatchCost] = useState<string>('');
  const [batchPrice, setBatchPrice] = useState<string>('');

  useEffect(() => {
    inputRef.current?.focus();
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
      const uniqueTac = imei.substring(0, 8);
      let def = await getDeviceDefinition(uniqueTac);

      if (!def) {
        const proxy = await fetchDeviceFromProxy(imei);
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
        setScannedItems((prev) =>
          prev.map((item) =>
            item.tempId === tempId
              ? {
                  ...item,
                  brand: def!.brand,
                  model: def!.model,
                  storage:
                    (def as { brand: string; model: string; storage?: string; updatedAt: number })
                      .storage || item.storage,
                  theftStatus: 'CLEAN', // Default since check is disabled
                  status: 'success',
                }
              : item
          )
        );
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

  const handleUpdateItem = (id: string, field: keyof ScannedItem, value: string | number) => {
    setScannedItems((prev) => {
      const next = prev.map((item) => (item.tempId === id ? { ...item, [field]: value } : item));

      // SMART LEARNING: If Brand+Model are filled, save to local DB
      const updatedItem = next.find((i) => i.tempId === id);
      if (updatedItem && (field === 'brand' || field === 'model')) {
        if (updatedItem.brand && updatedItem.model && updatedItem.imei.length >= 8) {
          const tac = updatedItem.imei.substring(0, 8);
          saveDeviceDefinition(tac, updatedItem.brand, updatedItem.model);
        }
      }
      return next;
    });
  };

  const applyBatch = () => {
    if (!batchCost && !batchPrice) return;
    setScannedItems((prev) =>
      prev.map((item) => ({
        ...item,
        cost: batchCost ? parseFloat(batchCost) : item.cost,
        price: batchPrice ? parseFloat(batchPrice) : item.price,
      }))
    );
    toast.success('Precios aplicados a todo el lote');
  };

  const handleSubmitAll = async () => {
    const invalid = scannedItems.filter(
      (i) => !i.brand || !i.model || i.price === undefined || i.price === null
    );
    if (invalid.length > 0) {
      toast.error(`Faltan datos en ${invalid.length} teléfonos`);
      return;
    }

    setIsProcessing(true);
    try {
      const promises = scannedItems.map((item) =>
        createPhone.mutateAsync({
          imei: item.imei,
          marca: item.brand,
          modelo: item.model,
          storage: item.storage,
          costo: item.cost,
          precioVenta: item.price,
          lote: batchLot,
          estado: 'En Stock (Disponible para Venta)',
          condition: 'Grade A',
        })
      );

      await Promise.all(promises);
      toast.success(`${scannedItems.length} teléfonos creados!`);
      onSuccess();
    } catch {
      toast.error('Error al guardar algunos teléfonos');
    } finally {
      setIsProcessing(false);
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
              className="w-full bg-slate-800/50 border border-slate-600 text-white text-3xl p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono transition-all placeholder:text-slate-700"
              placeholder="Escanea aquí..."
              autoComplete="off"
              autoFocus
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
              ENTER para procesar
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
                      item.status === 'success'
                        ? 'bg-green-100 text-green-600'
                        : item.status === 'unknown'
                          ? 'bg-amber-100 text-amber-600'
                          : item.status === 'pending'
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {item.status === 'pending' ? (
                      <span className="animate-spin">⏳</span>
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

                    <div className="md:col-span-5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                        MARCA / MODELO
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

                    <div className="md:col-span-2">
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
                            className="px-2 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200 animate-pulse"
                            title="Verificando o API Limitada"
                          >
                            ...
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

                    <div className="md:col-span-1 flex justify-end">
                      <button
                        onClick={() => handleRemove(item.tempId)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Floating Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none flex justify-center z-30">
        {scannedItems.length > 0 && (
          <div className="pointer-events-auto shadow-2xl rounded-2xl overflow-hidden">
            <button
              onClick={handleSubmitAll}
              disabled={isProcessing}
              className="bg-slate-900 text-white px-8 py-4 font-bold text-lg flex items-center gap-3 hover:bg-slate-800 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
            >
              {isProcessing ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
              Procesar {scannedItems.length} Dispositivos
            </button>
          </div>
        )}
      </div>

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
