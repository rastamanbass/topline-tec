import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useInventoryStore } from '../stores/inventoryStore';
import { useCreatePhone, useUpdatePhone } from '../hooks/usePhones';
import { phoneSchema, type PhoneFormData } from '../validation/phoneSchema';
import type { PhoneStatus } from '../../../types';
import { useEffect } from 'react';

const PHONE_STATUSES: PhoneStatus[] = [
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

export default function PhoneModal() {
  const { isModalOpen, modalMode, selectedPhone, closeModal } = useInventoryStore();
  const createPhone = useCreatePhone();
  const updatePhone = useUpdatePhone();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      imei: '',
      marca: '',
      modelo: '',
      lote: '',
      costo: 0,
      precioVenta: 0,
      estado: 'En Stock (Disponible para Venta)',
    },
  });

  // Load selected phone data when editing
  useEffect(() => {
    if (modalMode === 'edit' && selectedPhone) {
      setValue('imei', selectedPhone.imei);
      setValue('marca', selectedPhone.marca);
      setValue('modelo', selectedPhone.modelo);
      setValue('lote', selectedPhone.lote);
      setValue('costo', selectedPhone.costo);
      setValue('precioVenta', selectedPhone.precioVenta);
      setValue('estado', selectedPhone.estado);
    } else {
      reset();
    }
  }, [modalMode, selectedPhone, setValue, reset]);

  const onSubmit = async (data: PhoneFormData) => {
    try {
      if (modalMode === 'create') {
        await createPhone.mutateAsync(data);
      } else if (modalMode === 'edit' && selectedPhone) {
        await updatePhone.mutateAsync({
          id: selectedPhone.id,
          data,
        });
      }
      closeModal();
      reset();
    } catch (error) {
      // Error handling is done in the mutation hooks via toast
      console.error('Form submission error:', error);
    }
  };

  if (!isModalOpen || modalMode === 'view') return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {modalMode === 'create' ? 'Nuevo Teléfono' : 'Editar Teléfono'}
          </h2>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* IMEI */}
          <div>
            <label htmlFor="imei" className="block text-sm font-medium text-gray-700 mb-1">
              IMEI <span className="text-red-500">*</span>
            </label>
            <input
              id="imei"
              type="text"
              {...register('imei')}
              className={`input-field ${errors.imei ? 'border-red-500' : ''}`}
              placeholder="123456789012345"
              disabled={modalMode === 'edit'} // IMEI shouldn't change
            />
            {errors.imei && <p className="mt-1 text-sm text-red-600">{errors.imei.message}</p>}
          </div>

          {/* Marca and Modelo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="marca" className="block text-sm font-medium text-gray-700 mb-1">
                Marca <span className="text-red-500">*</span>
              </label>
              <input
                id="marca"
                type="text"
                {...register('marca')}
                className={`input-field ${errors.marca ? 'border-red-500' : ''}`}
                placeholder="Apple, Samsung, etc."
              />
              {errors.marca && <p className="mt-1 text-sm text-red-600">{errors.marca.message}</p>}
            </div>

            <div>
              <label htmlFor="modelo" className="block text-sm font-medium text-gray-700 mb-1">
                Modelo <span className="text-red-500">*</span>
              </label>
              <input
                id="modelo"
                type="text"
                {...register('modelo')}
                className={`input-field ${errors.modelo ? 'border-red-500' : ''}`}
                placeholder="iPhone 15 Pro Max"
              />
              {errors.modelo && (
                <p className="mt-1 text-sm text-red-600">{errors.modelo.message}</p>
              )}
            </div>
          </div>

          {/* Lote */}
          <div>
            <label htmlFor="lote" className="block text-sm font-medium text-gray-700 mb-1">
              Lote <span className="text-red-500">*</span>
            </label>
            <input
              id="lote"
              type="text"
              {...register('lote')}
              className={`input-field ${errors.lote ? 'border-red-500' : ''}`}
              placeholder="LOTE-2024-01"
            />
            {errors.lote && <p className="mt-1 text-sm text-red-600">{errors.lote.message}</p>}
          </div>

          {/* Costo and Precio Venta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="costo" className="block text-sm font-medium text-gray-700 mb-1">
                Costo (USD) <span className="text-red-500">*</span>
              </label>
              <input
                id="costo"
                type="number"
                step="0.01"
                {...register('costo', { valueAsNumber: true })}
                className={`input-field ${errors.costo ? 'border-red-500' : ''}`}
                placeholder="500.00"
              />
              {errors.costo && <p className="mt-1 text-sm text-red-600">{errors.costo.message}</p>}
            </div>

            <div>
              <label htmlFor="precioVenta" className="block text-sm font-medium text-gray-700 mb-1">
                Precio Venta (USD) <span className="text-red-500">*</span>
              </label>
              <input
                id="precioVenta"
                type="number"
                step="0.01"
                {...register('precioVenta', { valueAsNumber: true })}
                className={`input-field ${errors.precioVenta ? 'border-red-500' : ''}`}
                placeholder="650.00"
              />
              {errors.precioVenta && (
                <p className="mt-1 text-sm text-red-600">{errors.precioVenta.message}</p>
              )}
            </div>
          </div>

          {/* Estado */}
          <div>
            <label htmlFor="estado" className="block text-sm font-medium text-gray-700 mb-1">
              Estado <span className="text-red-500">*</span>
            </label>
            <select
              id="estado"
              {...register('estado')}
              className={`input-field ${errors.estado ? 'border-red-500' : ''}`}
            >
              {PHONE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            {errors.estado && <p className="mt-1 text-sm text-red-600">{errors.estado.message}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={closeModal}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting
                ? 'Guardando...'
                : modalMode === 'create'
                  ? 'Crear Teléfono'
                  : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
