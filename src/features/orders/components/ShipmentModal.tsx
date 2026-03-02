import React, { useState, useEffect } from 'react';
import { X, Truck } from 'lucide-react';
import type { PendingOrder, Shipment, ShipmentCarrier, ShipmentStatus } from '../../../types';
import { useCreateShipment, useUpdateShipmentStatus } from '../hooks/useShipments';
import ShipmentStatusBadge from './ShipmentStatusBadge';

interface ShipmentModalProps {
  orderId: string;
  order: PendingOrder | null;
  existingShipment?: Shipment | null;
  onClose: () => void;
}

const CARRIER_OPTIONS: ShipmentCarrier[] = [
  'Persona',
  'Transnexpress',
  'King Express',
  'Cargo a Tu Puerta',
  'UPS',
  'DHL',
  'Otro',
];

const STATUS_OPTIONS: { value: ShipmentStatus; label: string }[] = [
  { value: 'preparando',     label: 'Preparando' },
  { value: 'en_bodega_usa',  label: 'En bodega USA' },
  { value: 'en_transito',    label: 'En transito' },
  { value: 'en_aduana',      label: 'En aduana' },
  { value: 'en_el_salvador', label: 'En El Salvador' },
  { value: 'entregado',      label: 'Entregado' },
];

export default function ShipmentModal({ orderId, order, existingShipment, onClose }: ShipmentModalProps) {
  const isEditMode = !!existingShipment;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [carrier, setCarrier] = useState<ShipmentCarrier>(
    existingShipment?.carrier ?? 'Transnexpress'
  );
  const [carrierCustomName, setCarrierCustomName] = useState(
    existingShipment?.carrierCustomName ?? ''
  );
  const [courierName, setCourierName] = useState(
    existingShipment?.courierName ?? ''
  );
  const [trackingNumber, setTrackingNumber] = useState(
    existingShipment?.trackingNumber ?? ''
  );
  const [estimatedArrival, setEstimatedArrival] = useState(
    existingShipment?.estimatedArrival ?? ''
  );
  const [notes, setNotes] = useState(existingShipment?.notes ?? '');
  const [newStatus, setNewStatus] = useState<ShipmentStatus>(
    existingShipment?.status ?? 'preparando'
  );

  // Reset derived fields when carrier changes
  useEffect(() => {
    if (carrier !== 'Otro') setCarrierCustomName('');
    if (carrier !== 'Persona') setCourierName('');
    if (carrier === 'Persona') setTrackingNumber('');
  }, [carrier]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const createShipment = useCreateShipment();
  const updateStatus = useUpdateShipmentStatus();

  const isPending = createShipment.isPending || updateStatus.isPending;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    await createShipment.mutateAsync({
      orderId,
      phoneIds: order.phoneIds ?? [],
      carrier,
      carrierCustomName: carrier === 'Otro' ? carrierCustomName : undefined,
      courierName: carrier === 'Persona' ? courierName : undefined,
      trackingNumber: carrier !== 'Persona' ? trackingNumber || undefined : undefined,
      status: 'preparando',
      estimatedArrival: estimatedArrival || undefined,
      notes: notes || undefined,
      clientId: order.clientId,
      clientName: order.clientAlias ?? order.clientEmail ?? undefined,
    });
    onClose();
  };

  const handleUpdateStatus = async () => {
    if (!existingShipment) return;
    await updateStatus.mutateAsync({
      shipmentId: existingShipment.id,
      status: newStatus,
      orderId,
      phoneIds: existingShipment.phoneIds,
    });
    onClose();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">
              {isEditMode ? 'Actualizar envio' : 'Crear envio'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Order info */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Orden:</span>{' '}
            <span className="font-mono">#{orderId.slice(0, 8).toUpperCase()}</span>
            {order?.phones && (
              <p className="text-xs text-gray-400 mt-0.5">
                {order.phones.map((p) => `${p.marca} ${p.modelo}`).join(' · ')}
              </p>
            )}
          </div>

          {/* Edit mode: current status badge + status selector */}
          {isEditMode && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Estado actual:</span>
                <ShipmentStatusBadge status={existingShipment!.status} size="sm" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Cambiar estado
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ShipmentStatus)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {newStatus === 'entregado' && (
                  <p className="text-xs text-amber-600 mt-1">
                    Al marcar como entregado, la orden y los telefonos se actualizaran automaticamente.
                  </p>
                )}
              </div>

              <button
                onClick={handleUpdateStatus}
                disabled={isPending || newStatus === existingShipment!.status}
                className="w-full py-2 px-4 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Guardando...' : 'Actualizar estado'}
              </button>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Detalles del envio
                </p>
              </div>
            </div>
          )}

          {/* Form: create mode or always-visible details */}
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Carrier */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Transportista / Modalidad
              </label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value as ShipmentCarrier)}
                disabled={isEditMode}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50 disabled:text-gray-400"
              >
                {CARRIER_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Carrier custom name (Otro) */}
            {carrier === 'Otro' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nombre del transportista
                </label>
                <input
                  type="text"
                  value={carrierCustomName}
                  onChange={(e) => setCarrierCustomName(e.target.value)}
                  disabled={isEditMode}
                  placeholder="Ej: Cargo Express"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
                />
              </div>
            )}

            {/* Courier name (Persona) */}
            {carrier === 'Persona' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nombre del courier
                </label>
                <input
                  type="text"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  disabled={isEditMode}
                  placeholder="Nombre completo de quien lleva los equipos"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
                />
              </div>
            )}

            {/* Tracking number (all except Persona) */}
            {carrier !== 'Persona' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Numero de guia
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  disabled={isEditMode}
                  placeholder="Ej: TRX-2024-001234"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
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
                disabled={isEditMode}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Notas <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isEditMode}
                rows={3}
                placeholder="Observaciones adicionales..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none disabled:bg-gray-50"
              />
            </div>

            {/* Submit button — only in create mode */}
            {!isEditMode && (
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-4 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Guardando...' : 'Crear envio'}
                </button>
              </div>
            )}
          </form>

          {/* Close button in edit mode */}
          {isEditMode && (
            <button
              onClick={onClose}
              className="w-full py-2 px-4 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
