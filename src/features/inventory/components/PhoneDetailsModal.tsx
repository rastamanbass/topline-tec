import { X, Edit2, Trash2, Calendar, DollarSign, Package } from 'lucide-react';
import { useInventoryStore } from '../stores/inventoryStore';
import { useAuth } from '../../../context';
import { useDeletePhone } from '../hooks/usePhones';
import StatusBadge from './StatusBadge';

export default function PhoneDetailsModal() {
  const { isModalOpen, modalMode, selectedPhone, closeModal, openModal } = useInventoryStore();
  const { userRole } = useAuth();
  const deletePhone = useDeletePhone();

  if (!isModalOpen || modalMode !== 'view' || !selectedPhone) return null;

  const canEdit = ['admin', 'gerente'].includes(userRole || '');
  const canDelete = userRole === 'admin';

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

  const handleDelete = async () => {
    if (confirm(`¿Estás seguro de eliminar el teléfono ${selectedPhone.imei}?`)) {
      await deletePhone.mutateAsync(selectedPhone.id);
      closeModal();
    }
  };

  const handleEdit = () => {
    openModal('edit', selectedPhone);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Detalles del Teléfono</h2>
            <p className="text-sm text-gray-600 mt-1">IMEI: {selectedPhone.imei}</p>
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

          {/* Financial Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Información Financiera
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Costo</label>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(selectedPhone.costo)}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Precio de Venta
                </label>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(selectedPhone.precioVenta)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Margen</label>
                <p className="text-base font-medium text-blue-600">
                  {formatCurrency(selectedPhone.precioVenta - selectedPhone.costo)}
                  <span className="text-sm text-gray-600 ml-2">
                    (
                    {(
                      ((selectedPhone.precioVenta - selectedPhone.costo) / selectedPhone.costo) *
                      100
                    ).toFixed(1)}
                    %)
                  </span>
                </p>
              </div>
            </div>
          </div>

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

          {/* Status History */}
          {selectedPhone.statusHistory && selectedPhone.statusHistory.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Historial de Estados ({selectedPhone.statusHistory.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedPhone.statusHistory.map((change, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-lg text-sm"
                  >
                    <div className="flex-1">
                      <StatusBadge status={change.newStatus} size="sm" />
                      {change.details && (
                        <p className="text-gray-600 mt-1 text-xs">{change.details}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xs text-gray-500">
                        {new Intl.DateTimeFormat('es-SV', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(change.date)}
                      </p>
                      <p className="text-xs text-gray-400">{change.user}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button onClick={closeModal} className="btn-secondary">
            Cerrar
          </button>
          <div className="flex items-center gap-3">
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
