import { Trash2, RefreshCw, ShoppingCart } from 'lucide-react';
import { useInventoryStore } from '../stores/inventoryStore';
import { useSalesStore } from '../../sales/stores/salesStore';
import { useAuth } from '../../../context';
import { useDeletePhone } from '../hooks/usePhones';
import toast from 'react-hot-toast';
import type { Phone } from '../../../types';
import BulkStatusModal from './BulkStatusModal';
import { useState } from 'react';

interface BulkActionsProps {
  phones: Phone[];
}

export default function BulkActions({ phones }: BulkActionsProps) {
  const { selectedPhoneIds, clearSelection } = useInventoryStore();
  const { userRole } = useAuth();
  const deletePhone = useDeletePhone();
  const { addToCart, openPaymentModal, clearCart } = useSalesStore();
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  if (selectedPhoneIds.size === 0) return null;

  const count = selectedPhoneIds.size;
  const canDelete = userRole === 'admin';
  const canChangeStatus = userRole === 'admin';

  const handleBulkSell = () => {
    const selectedPhones = phones.filter((p) => selectedPhoneIds.has(p.id));
    // Check if any selected phone is not 'Disponible'
    const unavailable = selectedPhones.filter(
      (p) => p.estado !== 'En Stock (Disponible para Venta)'
    );
    if (unavailable.length > 0) {
      toast.error(`Hay ${unavailable.length} teléfonos no disponibles para venta`);
      return;
    }

    clearCart(); // Start fresh for bulk sell? Typically yes for this flow.
    selectedPhones.forEach((phone) => {
      addToCart({
        id: phone.id,
        phoneId: phone.id,
        imei: phone.imei,
        description: `${phone.marca} ${phone.modelo}`,
        price: phone.precioVenta,
        quantity: 1, // Phones are unique, qty 1
        type: 'phone',
      });
    });

    openPaymentModal();
  };

  const handleBulkStatusChange = () => {
    setIsStatusModalOpen(true);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`¿Estás seguro de eliminar ${count} teléfonos seleccionados?`)) return;

    try {
      const promises = Array.from(selectedPhoneIds).map((id) => deletePhone.mutateAsync(id));
      await Promise.all(promises);
      toast.success(`${count} teléfonos eliminados correcamente`);
      clearSelection();
    } catch (error) {
      console.error('Error deleting phones:', error);
      toast.error('Error al eliminar algunos teléfonos');
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-blue-700 font-medium">
          {count} teléfono{count !== 1 ? 's' : ''} seleccionado{count !== 1 ? 's' : ''}
        </span>
        <button
          onClick={clearSelection}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Deseleccionar todo
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleBulkSell}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
        >
          <ShoppingCart className="w-4 h-4" />
          Venta Rápida
        </button>

        {canChangeStatus && (
          <button
            onClick={handleBulkStatusChange}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Cambiar Estado
          </button>
        )}

        {canDelete && (
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        )}
      </div>

      <BulkStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        selectedPhones={phones.filter((p) => selectedPhoneIds.has(p.id))}
      />
    </div>
  );
}
