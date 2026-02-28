import { Edit2, Trash2, Eye, RefreshCw, Loader2, ShoppingCart } from 'lucide-react';
import { useInventoryStore } from '../stores/inventoryStore';
import { useSalesStore } from '../../sales/stores/salesStore';
import { useAuth } from '../../../context';
import StatusBadgePro from '../../../components/ui/StatusBadgePro';
import StatusChangeModal from './StatusChangeModal';
import { useState } from 'react';
import type { Phone } from '../../../types';

interface PhoneTableProps {
  phones?: Phone[];
  isLoading: boolean;
  error: unknown;
}

export default function PhoneTable({ phones, isLoading, error }: PhoneTableProps) {
  const { openModal, selectedPhoneIds, toggleSelection, selectAll, clearSelection } =
    useInventoryStore();
  const { addToCart, openPaymentModal } = useSalesStore();
  const { userRole } = useAuth();

  // Status change modal state
  const [statusChangePhone, setStatusChangePhone] = useState<Phone | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Permissions
  const canEdit = ['admin', 'gerente'].includes(userRole || '');
  const canDelete = userRole === 'admin';

  const handleSell = (phone: Phone) => {
    addToCart({
      id: phone.id,
      phoneId: phone.id,
      imei: phone.imei,
      description: `${phone.marca} ${phone.modelo}`,
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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        <span className="ml-3 text-gray-600">Cargando inventario...</span>
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
      <div className="text-center py-12">
        <p className="text-gray-600">No se encontraron teléfonos</p>
        <p className="text-sm text-gray-500 mt-1">
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
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50/80 backdrop-blur-sm sticky top-0 z-10">
          <tr>
            <th className="px-6 py-4 text-left w-10">
              <input
                type="checkbox"
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
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
              Costo
            </th>
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
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 transition-colors cursor-pointer"
                  checked={selectedPhoneIds.has(phone.id)}
                  onChange={() => toggleSelection(phone.id)}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-900">{phone.modelo}</span>
                  <span className="text-xs text-gray-500 font-mono">{phone.imei}</span>
                  <span className="text-xs text-primary-600">{phone.marca}</span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                {phone.lote}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatCurrency(phone.costo)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                {formatCurrency(phone.precioVenta)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadgePro status={phone.estado} size="sm" />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleSell(phone)}
                    className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                    title="Vender"
                    disabled={phone.estado !== 'En Stock (Disponible para Venta)'}
                  >
                    <ShoppingCart className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openModal('view', phone)}
                    className="p-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Ver detalles"
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
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openModal('edit', phone)}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => {
                        if (confirm('¿Estás seguro de eliminar este teléfono?')) {
                          // In real app execute delete
                          console.log('Delete');
                        }
                      }}
                      className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      title="Eliminar"
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
    </div>
  );
}
