import { Edit2, Trash2, Eye, RefreshCw, Loader2, ShoppingCart } from 'lucide-react';
import { useInventoryStore } from '../stores/inventoryStore';
import { useSalesStore } from '../../sales/stores/salesStore';
import { useAuth } from '../../../context';
import { canViewCosts } from '../../../lib/permissions';
import StatusBadgePro from '../../../components/ui/StatusBadgePro';
import StatusChangeModal from './StatusChangeModal';
import ConfirmModal from '../../../components/ConfirmModal';
import { useState, useMemo } from 'react';
import type { Phone } from '../../../types';
import { useDeletePhone } from '../hooks/usePhones';
import { phoneLabel } from '../../../lib/phoneUtils';

interface PhoneTableProps {
  phones?: Phone[];
  isLoading: boolean;
  error: unknown;
}

export default function PhoneTable({ phones, isLoading, error }: PhoneTableProps) {
  const { openModal, selectedPhoneIds, toggleSelection, selectAll, clearSelection } =
    useInventoryStore();
  const { addToCart, openPaymentModal } = useSalesStore();
  const { user, userRole } = useAuth();
  const showCosts = useMemo(() => canViewCosts(user?.email), [user?.email]);
  const deletePhone = useDeletePhone();

  // Status change modal state
  const [statusChangePhone, setStatusChangePhone] = useState<Phone | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Delete confirm modal state
  const [deleteTarget, setDeleteTarget] = useState<Phone | null>(null);

  // Permissions
  const canEdit = ['admin', 'gerente'].includes(userRole || '');
  const canDelete = userRole === 'admin';

  // Snapshot of "now" for reservation TTL checks
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  const handleSell = (phone: Phone) => {
    addToCart({
      id: phone.id,
      phoneId: phone.id,
      imei: phone.imei,
      description: phoneLabel(phone.marca, phone.modelo),
      price: phone.precioVenta,
      quantity: 1,
      type: 'phone',
    });
    openPaymentModal();
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Loading state — skeleton rows
  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 animate-pulse">
          <thead className="bg-gray-50">
            <tr>
              {['w-10', 'w-40', 'w-24', 'w-20', 'w-20', 'w-28', 'w-24'].map((w, i) => (
                <th key={i} className={`px-6 py-4 ${i === 6 ? 'text-right' : 'text-left'}`}>
                  <div className={`h-3 bg-gray-200 rounded ${w}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {[...Array(6)].map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <div className="h-4 w-4 bg-gray-200 rounded" />
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1.5">
                    <div className="h-3.5 bg-gray-200 rounded w-32" />
                    <div className="h-2.5 bg-gray-100 rounded w-24" />
                    <div className="h-2.5 bg-gray-100 rounded w-16" />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-3.5 bg-gray-200 rounded w-16" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-3.5 bg-gray-200 rounded w-14" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-3.5 bg-gray-200 rounded w-14" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-6 bg-gray-200 rounded-full w-24" />
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="h-7 bg-gray-200 rounded-lg w-20 ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Error al cargar inventario</p>
        <p className="text-sm text-gray-600 mt-2">{(error as Error).message}</p>
      </div>
    );
  }

  // Empty state
  if (!phones || phones.length === 0) {
    return (
      <div className="text-center py-16 flex flex-col items-center gap-3">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-gray-300" />
        </div>
        <p className="text-gray-600 font-medium">No se encontraron teléfonos</p>
        <p className="text-sm text-gray-400">
          Intenta ajustar los filtros o crea tu primer teléfono
        </p>
      </div>
    );
  }

  // Selection Logic
  const allSelected = phones.length > 0 && phones.every((p) => selectedPhoneIds.has(p.id));
  const isIndeterminate = selectedPhoneIds.size > 0 && selectedPhoneIds.size < phones.length;

  return (
    <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200" aria-label="Inventario de teléfonos">
        <thead className="bg-gray-50/80 backdrop-blur-sm sticky top-0 z-10">
          <tr>
            <th className="px-6 py-4 text-left w-10">
              <input
                type="checkbox"
                aria-label="Seleccionar todos los teléfonos"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 transition-colors cursor-pointer"
                checked={allSelected}
                ref={(input) => {
                  if (input) input.indeterminate = isIndeterminate;
                }}
                onChange={() => {
                  if (allSelected) clearSelection();
                  else selectAll(phones.map((p) => p.id));
                }}
              />
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
              Item Details
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
              Lote
            </th>
            {showCosts && (
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                Costo
              </th>
            )}
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
              Precio
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {phones.map((phone: Phone) => (
            <tr key={phone.id} className="hover:bg-gray-50 transition-colors group">
              <td className="px-6 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  aria-label={`Seleccionar ${phone.modelo} (${phone.imei})`}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 transition-colors cursor-pointer"
                  checked={selectedPhoneIds.has(phone.id)}
                  onChange={() => toggleSelection(phone.id)}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-900">{phone.modelo}</span>
                  <span className="text-xs text-gray-500 font-mono">{phone.imei}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-primary-600">{phone.marca}</span>
                    {phone.supplierCode && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wide"
                        title={`Proveedor: ${phone.supplierCode}`}
                      >
                        {phone.supplierCode}
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                {phone.lote}
              </td>
              {showCosts && (
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatCurrency(phone.costo)}
                </td>
              )}
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                {phone.precioVenta === 0 || phone.precioVenta == null ? (
                  <span className="text-orange-500 font-medium text-sm">Sin precio</span>
                ) : (
                  <span className="text-gray-900">{formatCurrency(phone.precioVenta)}</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadgePro status={phone.estado} size="sm" />
                {phone.reservation != null &&
                  phone.reservation.reservedBy === 'POS_SALE' &&
                  (phone.reservation.expiresAt ?? 0) > nowMs && (
                    <p className="text-[10px] text-orange-500 font-medium mt-0.5">(reservado)</p>
                  )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleSell(phone)}
                    className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title={
                      phone.reservation != null &&
                      phone.reservation.reservedBy === 'POS_SALE' &&
                      (phone.reservation.expiresAt ?? 0) > nowMs
                        ? 'Reservado en proceso de venta'
                        : 'Vender'
                    }
                    aria-label={`Vender ${phone.marca} ${phone.modelo}`}
                    disabled={
                      phone.estado !== 'En Stock (Disponible para Venta)' ||
                      (phone.reservation != null &&
                        phone.reservation.reservedBy === 'POS_SALE' &&
                        (phone.reservation.expiresAt ?? 0) > nowMs)
                    }
                  >
                    <ShoppingCart className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openModal('view', phone)}
                    className="p-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Ver detalles"
                    aria-label={`Ver detalles de ${phone.marca} ${phone.modelo}`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => {
                          setStatusChangePhone(phone);
                          setIsStatusModalOpen(true);
                        }}
                        className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"
                        title="Cambiar estado"
                        aria-label={`Cambiar estado de ${phone.marca} ${phone.modelo}`}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openModal('edit', phone)}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                        title="Editar"
                        aria-label={`Editar ${phone.marca} ${phone.modelo}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => setDeleteTarget(phone)}
                      disabled={deletePhone.isPending}
                      className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Eliminar"
                      aria-label={`Eliminar ${phone.marca} ${phone.modelo}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Results count */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-xs text-gray-500">
        <span>
          Mostrando <span className="font-bold text-gray-900">{phones.length}</span> resultados
        </span>
        <span>Selección: {selectedPhoneIds.size}</span>
      </div>

      {/* Status Change Modal */}
      <StatusChangeModal
        phone={statusChangePhone}
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setStatusChangePhone(null);
        }}
      />

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Eliminar teléfono"
        message={`¿Eliminar ${deleteTarget?.marca} ${deleteTarget?.modelo}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deleteTarget) deletePhone.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
