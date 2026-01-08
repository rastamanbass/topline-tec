import { X, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useChangePhoneStatus } from '../hooks/usePhones';
import type { Phone, PhoneStatus } from '../../../types';

const ALL_PHONE_STATUSES: PhoneStatus[] = [
  'En Bodega (USA)',
  'En Tránsito (a El Salvador)',
  'En Stock (Disponible para Venta)',
  'Apartado',
  'Pagado',
  'Vendido (Pendiente de Entrega)',
  'Vendido',
  'Enviado a Taller (Garantía)',
  'Enviado a Taller (Externo)',
  'En Taller (Recibido)',
  'Enviado a Gerencia (Pendiente)',
  'Enviado a Gerencia',
  'Recibido de Taller (OK)',
  'Entregado al Cliente',
  'Reingreso (Tomado como parte de pago)',
  'De Baja',
];

interface StatusChangeModalProps {
  phone: Phone | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function StatusChangeModal({ phone, isOpen, onClose }: StatusChangeModalProps) {
  const [newStatus, setNewStatus] = useState<PhoneStatus | ''>('');
  const [details, setDetails] = useState('');
  const changeStatus = useChangePhoneStatus();

  if (!isOpen || !phone) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatus) return;

    try {
      await changeStatus.mutateAsync({
        id: phone.id,
        newStatus: newStatus as PhoneStatus,
        details: details || undefined,
      });
      onClose();
      setNewStatus('');
      setDetails('');
    } catch (error) {
      console.error('Error changing status:', error);
    }
  };

  const handleClose = () => {
    onClose();
    setNewStatus('');
    setDetails('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Cambiar Estado</h2>
              <p className="text-sm text-gray-600">IMEI: {phone.imei}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado Actual</label>
            <p className="text-base font-semibold text-gray-900">{phone.estado}</p>
          </div>

          {/* New Status */}
          <div>
            <label htmlFor="newStatus" className="block text-sm font-medium text-gray-700 mb-1">
              Nuevo Estado <span className="text-red-500">*</span>
            </label>
            <select
              id="newStatus"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as PhoneStatus)}
              className="input-field"
              required
            >
              <option value="">Seleccionar estado...</option>
              {ALL_PHONE_STATUSES.map((status) => (
                <option key={status} value={status} disabled={status === phone.estado}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Details/Notes */}
          <div>
            <label htmlFor="details" className="block text-sm font-medium text-gray-700 mb-1">
              Detalles (opcional)
            </label>
            <textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="input-field resize-none"
              rows={3}
              placeholder="Ej: Cliente pagó abono, Recibido de taller con pantalla nueva..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
              disabled={changeStatus.isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={changeStatus.isPending || !newStatus}
            >
              {changeStatus.isPending ? 'Actualizando...' : 'Cambiar Estado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
