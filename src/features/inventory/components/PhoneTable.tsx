import { Eye, Edit2, Trash2, Loader2 } from 'lucide-react';
import { usePhones } from '../hooks/usePhones';
import { useInventoryStore } from '../stores/inventoryStore';
import { useAuth } from '../../../context';
import StatusBadge from './StatusBadge';
import type { Phone } from '../../../types';

export default function PhoneTable() {
  const { searchQuery, selectedLot, selectedStatus } = useInventoryStore();
  const { openModal } = useInventoryStore();
  const { userRole } = useAuth();

  // Fetch phones with filters
  const {
    data: phones,
    isLoading,
    error,
  } = usePhones({
    lot: selectedLot,
    status: selectedStatus,
    searchQuery,
  });

  // Permissions
  const canEdit = ['admin', 'gerente'].includes(userRole || '');
  const canDelete = userRole === 'admin';

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-SV', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
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
          {searchQuery || selectedLot || selectedStatus
            ? 'Intenta ajustar los filtros'
            : 'Crea tu primer teléfono'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              IMEI
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Marca
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Modelo
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Lote
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Costo
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Precio Venta
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha Ingreso
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {phones.map((phone: Phone) => (
            <tr key={phone.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {phone.imei}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{phone.marca}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{phone.modelo}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{phone.lote}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {formatCurrency(phone.costo)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {formatCurrency(phone.precioVenta)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={phone.estado} size="sm" />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {formatDate(phone.fechaIngreso)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => openModal('view', phone)}
                    className="text-primary-600 hover:text-primary-900"
                    title="Ver detalles"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => openModal('edit', phone)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => {
                        if (confirm('¿Estás seguro de eliminar este teléfono?')) {
                          // TODO: Implement delete
                          console.log('Delete phone:', phone.id);
                        }
                      }}
                      className="text-red-600 hover:text-red-900"
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
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <p className="text-sm text-gray-700">
          Mostrando <span className="font-medium">{phones.length}</span> teléfono
          {phones.length !== 1 && 's'}
        </p>
      </div>
    </div>
  );
}
