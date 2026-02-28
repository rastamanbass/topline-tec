import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useChangePhoneStatus } from '../hooks/usePhones';
import type { PhoneStatus } from '../../../types';
import { useInventoryStore } from '../stores/inventoryStore';
import toast from 'react-hot-toast';

interface BulkStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ALL_STATUSES: PhoneStatus[] = [
  'En Bodega (USA)',
  'En Tránsito (a El Salvador)',
  'En Stock (Disponible para Venta)',
  'Enviado a Taller (Garantía)',
  'Enviado a Taller (Externo)',
  'En Taller (Recibido)',
  'Recibido de Taller (OK)',
  'Enviado a Gerencia (Pendiente)',
  'Enviado a Gerencia',
  'Reingreso (Tomado como parte de pago)',
  'De Baja',
];

export default function BulkStatusModal({ isOpen, onClose }: BulkStatusModalProps) {
  const { selectedPhoneIds, clearSelection } = useInventoryStore();
  const changeStatus = useChangePhoneStatus();
  const [selectedStatus, setSelectedStatus] = useState<PhoneStatus | ''>('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const count = selectedPhoneIds.size;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus) return;

    if (!confirm(`¿Confirmas cambiar el estado de ${count} equipos a "${selectedStatus}"?`)) return;

    setIsSubmitting(true);
    try {
      const promises = Array.from(selectedPhoneIds).map((id) =>
        changeStatus.mutateAsync({
          id,
          newStatus: selectedStatus as PhoneStatus,
          details: note ? `Cambio Masivo: ${note}` : 'Cambio Masivo de Estado',
        })
      );

      await Promise.all(promises);
      toast.success('Estados actualizados correctamente');
      clearSelection();
      onClose();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar algunos equipos');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Cambio Masivo de Estado</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm font-medium">
            Editando {count} equipo{count !== 1 ? 's' : ''} seleccionado{count !== 1 ? 's' : ''}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo Estado</label>
            <select
              required
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as PhoneStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">Seleccionar estado...</option>
              {ALL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nota (Opcional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="Motivo del cambio masivo..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedStatus}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Aplicar Cambio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
