import { useState, useMemo } from 'react';
import { X, Loader2, Package, ChevronDown, Truck } from 'lucide-react';
import { usePhones } from '../../inventory/hooks/usePhones';
import { useCreateImportShipment } from '../hooks/useImportShipments';
import type { ShipmentCarrier } from '../../../types';

const CARRIERS: ShipmentCarrier[] = [
  'Transnexpress',
  'King Express',
  'Cargo a Tu Puerta',
  'UPS',
  'DHL',
  'Persona',
  'Otro',
];

interface Props {
  onClose: () => void;
}

export default function CreateShipmentModal({ onClose }: Props) {
  const { data: bodegaPhones = [], isLoading } = usePhones({
    status: 'En Bodega (USA)',
  });

  // Unique lotes from phones in En Bodega
  const availableLotes = useMemo(
    () => [...new Set(bodegaPhones.map((p) => p.lote).filter(Boolean))].sort(),
    [bodegaPhones]
  );

  const [selectedLote, setSelectedLote] = useState('');
  const [shipmentName, setShipmentName] = useState('');
  const [carrier, setCarrier] = useState<ShipmentCarrier>('Transnexpress');
  const [carrierCustomName, setCarrierCustomName] = useState('');
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [notes, setNotes] = useState('');
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

  const createShipment = useCreateImportShipment();

  // Phones in the selected lote
  const lotePhones = useMemo(
    () => bodegaPhones.filter((p) => p.lote === selectedLote),
    [bodegaPhones, selectedLote]
  );

  // Selected phone IDs
  const selectedPhoneIds = useMemo(
    () => lotePhones.filter((p) => !deselected.has(p.id)).map((p) => p.id),
    [lotePhones, deselected]
  );

  const togglePhone = (id: string) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLoteChange = (lote: string) => {
    setSelectedLote(lote);
    setDeselected(new Set());
    // Auto-generate name
    if (lote && !shipmentName) {
      const now = new Date();
      const month = now.toLocaleString('es', { month: 'short' });
      setShipmentName(`Envío ${month} ${now.getFullYear()} — ${lote}`);
    }
  };

  const canSubmit =
    selectedLote &&
    shipmentName.trim() &&
    selectedPhoneIds.length > 0 &&
    (carrier !== 'Otro' || carrierCustomName.trim()) &&
    (carrier !== 'Persona' || courierName.trim());

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await createShipment.mutateAsync({
      name: shipmentName.trim(),
      lote: selectedLote,
      phoneIds: selectedPhoneIds,
      carrier,
      carrierCustomName: carrier === 'Otro' ? carrierCustomName.trim() : undefined,
      courierName: carrier === 'Persona' ? courierName.trim() : undefined,
      trackingNumber: trackingNumber.trim() || undefined,
      estimatedArrival: estimatedArrival || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Crear Envío USA → El Salvador</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Lote selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Lote a enviar <span className="text-red-500">*</span>
            </label>
            {isLoading ? (
              <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
            ) : availableLotes.length === 0 ? (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
                No hay teléfonos en "En Bodega (USA)". Importa una factura primero.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedLote}
                  onChange={(e) => handleLoteChange(e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Selecciona un lote —</option>
                  {availableLotes.map((l) => {
                    const count = bodegaPhones.filter((p) => p.lote === l).length;
                    return (
                      <option key={l} value={l}>
                        {l} ({count} teléfonos)
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Shipment name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Nombre del envío <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={shipmentName}
              onChange={(e) => setShipmentName(e.target.value)}
              placeholder="Ej: Envío Nov 2026 — Carlos"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          {/* Phone list for selected lote */}
          {selectedLote && lotePhones.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Teléfonos incluidos ({selectedPhoneIds.length}/{lotePhones.length})
                </label>
                <button
                  type="button"
                  onClick={() => setDeselected(new Set())}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Seleccionar todos
                </button>
              </div>
              <div className="rounded-xl border border-gray-200 overflow-hidden max-h-48 overflow-y-auto">
                {lotePhones.map((p) => {
                  const selected = !deselected.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${
                        selected ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 opacity-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => togglePhone(p.id)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {p.marca} {p.modelo}
                          {p.storage ? ` · ${p.storage}` : ''}
                        </p>
                        <p className="text-xs font-mono text-gray-400">{p.imei}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Carrier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Empresa de carga <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value as ShipmentCarrier)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CARRIERS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Número de guía
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="TRX-001 / AWB..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>

          {/* Conditional carrier fields */}
          {carrier === 'Otro' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nombre de la empresa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={carrierCustomName}
                onChange={(e) => setCarrierCustomName(e.target.value)}
                placeholder="Nombre de la empresa de carga"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          )}

          {carrier === 'Persona' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nombre del courier <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="Nombre de la persona que lleva el paquete"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          )}

          {/* Estimated arrival */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Fecha estimada de llegada
            </label>
            <input
              type="date"
              value={estimatedArrival}
              onChange={(e) => setEstimatedArrival(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones, instrucciones especiales..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
            />
          </div>

          {/* Summary */}
          {selectedPhoneIds.length > 0 && (
            <div className="bg-indigo-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <Package className="w-5 h-5 text-indigo-600 shrink-0" />
              <p className="text-sm text-indigo-800">
                <strong>{selectedPhoneIds.length} teléfonos</strong> pasarán a{' '}
                <strong>"En Tránsito (a El Salvador)"</strong> al crear este envío.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || createShipment.isPending}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors text-sm flex items-center justify-center gap-2"
            >
              {createShipment.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Truck className="w-4 h-4" />
              )}
              Crear Envío
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
