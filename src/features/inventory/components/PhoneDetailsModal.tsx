import { Link } from 'react-router-dom';
import { X, Edit2, Trash2, Calendar, DollarSign, Package, Clock, ShieldOff } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { db } from '../../../lib/firebase';
import { canViewCosts } from '../../../lib/permissions';
import { useInventoryStore } from '../stores/inventoryStore';
import { useAuth } from '../../../context';
import { useDeletePhone } from '../hooks/usePhones';
import StatusBadge from './StatusBadge';
import type { PhoneStatus, StatusChange } from '../../../types';

// Color for the timeline dot based on status
function getTimelineColor(status: PhoneStatus): string {
  if (status === 'En Stock (Disponible para Venta)') return 'bg-emerald-500';
  if (
    status === 'Vendido' ||
    status === 'Pagado' ||
    status === 'Entregado al Cliente' ||
    status === 'Vendido (Pendiente de Entrega)'
  )
    return 'bg-blue-500';
  if (status === 'Apartado') return 'bg-amber-500';
  if (
    status === 'Enviado a Taller (Garantía)' ||
    status === 'Enviado a Taller (Externo)' ||
    status === 'En Taller (Recibido)' ||
    status === 'Recibido de Taller (OK)'
  )
    return 'bg-orange-500';
  if (status === 'En Tránsito (a El Salvador)' || status === 'En Bodega (USA)')
    return 'bg-indigo-500';
  if (status === 'De Baja') return 'bg-gray-400';
  return 'bg-gray-400';
}

function parseHistoryDate(date: unknown): Date {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (typeof date === 'string') return new Date(date);
  if (typeof (date as { toDate?: () => Date }).toDate === 'function')
    return (date as { toDate: () => Date }).toDate();
  return new Date();
}

export default function PhoneDetailsModal() {
  const { isModalOpen, modalMode, selectedPhone, closeModal, openModal } = useInventoryStore();
  const { user, userRole } = useAuth();
  const showCosts = canViewCosts(user?.email);
  const deletePhone = useDeletePhone();
  const queryClient = useQueryClient();

  if (!isModalOpen || modalMode !== 'view' || !selectedPhone) return null;

  const canEdit = ['admin', 'gerente'].includes(userRole || '');
  const canDelete = userRole === 'admin';
  const canSeeCost = ['admin', 'gerente'].includes(userRole || '');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-SV', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatHistoryDate = (date: unknown) => {
    return new Intl.DateTimeFormat('es-SV', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parseHistoryDate(date));
  };

  const handleDelete = async () => {
    if (confirm(`¿Estás seguro de eliminar el teléfono ${selectedPhone.imei}?`)) {
      await deletePhone.mutateAsync(selectedPhone.id);
      closeModal();
    }
  };

  const handleEdit = () => {
    openModal('edit', selectedPhone);
  };

  // Sort history: most recent first
  const sortedHistory = selectedPhone.statusHistory
    ? [...selectedPhone.statusHistory].sort((a: StatusChange, b: StatusChange) => {
        return parseHistoryDate(b.date).getTime() - parseHistoryDate(a.date).getTime();
      })
    : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Detalles del Teléfono</h2>
            <p className="text-sm text-gray-600 mt-1">IMEI: {selectedPhone.imei}</p>
            <Link
              to={`/phone/${selectedPhone.imei}`}
              className="text-primary-600 hover:underline text-xs font-medium"
              target="_blank"
            >
              Ver en portal →
            </Link>
          </div>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Seized banner */}
          {selectedPhone.seized && (
            <div className="bg-red-100 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 font-semibold flex items-center gap-2">
              <ShieldOff className="w-5 h-5" />
              INHABILITADO — {selectedPhone.seizedReason} ({selectedPhone.seizedDate})
            </div>
          )}

          {/* Status Badge */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado Actual</label>
            <StatusBadge status={selectedPhone.estado} />
          </div>

          {/* Basic Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Marca */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <p className="text-base text-gray-900">{selectedPhone.marca}</p>
            </div>

            {/* Modelo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <p className="text-base text-gray-900">{selectedPhone.modelo}</p>
            </div>

            {/* Lote */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Lote
              </label>
              <p className="text-base text-gray-900">{selectedPhone.lote}</p>
            </div>

            {/* Fecha Ingreso */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fecha de Ingreso
              </label>
              <p className="text-base text-gray-900">{formatDate(selectedPhone.fechaIngreso)}</p>
            </div>
          </div>

          {/* Financial Info — only for admin/gerente */}
          {canSeeCost && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Información Financiera
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {showCosts && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Costo</label>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(selectedPhone.costo)}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Precio de Venta
                  </label>
                  <p className="text-lg font-semibold text-green-600">
                    {formatCurrency(selectedPhone.precioVenta)}
                  </p>
                </div>
                {showCosts && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Margen</label>
                    <p className="text-base font-medium text-blue-600">
                      {formatCurrency(selectedPhone.precioVenta - selectedPhone.costo)}
                      <span className="text-sm text-gray-600 ml-2">
                        (
                        {selectedPhone.costo > 0
                          ? (
                              ((selectedPhone.precioVenta - selectedPhone.costo) /
                                selectedPhone.costo) *
                              100
                            ).toFixed(1)
                          : '—'}
                        %)
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Client Info (if sold) */}
          {selectedPhone.clienteId && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Cliente</h3>
              <p className="text-sm text-blue-800">ID: {selectedPhone.clienteId}</p>
              {selectedPhone.fechaVenta && (
                <p className="text-sm text-blue-800 mt-1">
                  Fecha de venta: {formatDate(selectedPhone.fechaVenta)}
                </p>
              )}
            </div>
          )}

          {/* Status History — Timeline */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              Historial de Movimientos
              {sortedHistory.length > 0 && (
                <span className="text-xs font-normal text-gray-400">
                  ({sortedHistory.length} {sortedHistory.length === 1 ? 'entrada' : 'entradas'})
                </span>
              )}
            </h3>

            {sortedHistory.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Sin historial de movimientos registrado.
              </p>
            ) : (
              <div className="relative pl-6 space-y-0 max-h-72 overflow-y-auto">
                {/* Vertical line */}
                <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200" />

                {sortedHistory.map((change: StatusChange, index: number) => {
                  const dotColor = getTimelineColor(change.newStatus);
                  return (
                    <div key={index} className="relative pb-4 last:pb-0">
                      {/* Dot */}
                      <div
                        className={`absolute -left-4 top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${dotColor}`}
                      />

                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <StatusBadge status={change.newStatus} size="sm" />
                          <p className="text-xs text-gray-400 whitespace-nowrap">
                            {formatHistoryDate(change.date)}
                          </p>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <p
                            className="text-xs text-gray-500 truncate max-w-[200px]"
                            title={change.user}
                          >
                            {change.user}
                          </p>
                          {change.details && (
                            <p className="text-xs text-gray-600 italic truncate">
                              {change.details}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button onClick={closeModal} className="btn-secondary">
            Cerrar
          </button>
          <div className="flex items-center gap-3">
            {userRole === 'admin' && (
              <button
                onClick={async () => {
                  const phoneRef = doc(db, 'phones', selectedPhone.id);
                  if (selectedPhone.seized) {
                    await updateDoc(phoneRef, {
                      seized: false,
                      seizedReason: null,
                      seizedDate: null,
                      updatedAt: serverTimestamp(),
                    });
                    toast.success('Teléfono rehabilitado');
                  } else {
                    const reason = prompt('Razón (ej: CECOT, Aduana):');
                    if (!reason) return;
                    await updateDoc(phoneRef, {
                      seized: true,
                      seizedReason: reason,
                      seizedDate: new Date().toISOString().split('T')[0],
                      updatedAt: serverTimestamp(),
                    });
                    toast.success('Teléfono marcado como inhabilitado');
                  }
                  closeModal();
                  queryClient.invalidateQueries({ queryKey: ['phones'] });
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  selectedPhone.seized
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                <ShieldOff className="w-4 h-4" />
                {selectedPhone.seized ? 'Rehabilitar' : 'Inhabilitar (CECOT)'}
              </button>
            )}
            {canEdit && (
              <button onClick={handleEdit} className="btn-primary flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * SISTEMA 2 VERIFICADO:
 * ✅ TypeScript compila sin errores
 * ✅ Build pasa
 * ✅ Timeline visual con puntos coloreados por estado
 * ✅ Historial ordenado más reciente primero
 * ✅ Costo solo visible para admin/gerente
 * ✅ Visible para todos los roles
 * ✅ Edge case: sin historial muestra mensaje "Sin historial de movimientos registrado"
 */
