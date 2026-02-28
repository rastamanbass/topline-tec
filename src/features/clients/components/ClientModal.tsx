import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import {
  useCreateClient,
  useUpdateClient,
  useAddCreditAdjustment,
  useAddDebtAdjustment,
} from '../hooks/useClients';
import type { Client } from '../../../types';
import { useEffect } from 'react';
import { useAuth } from '../../../context';

const clientSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  creditAmount: z.number().min(0, 'No puede ser negativo'),
  debtAmount: z.number().min(0, 'No puede ser negativo'),
  isWorkshopAccount: z.boolean(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client | null;
}

export default function ClientModal({ isOpen, onClose, client }: ClientModalProps) {
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const addCreditAdjustment = useAddCreditAdjustment();
  const addDebtAdjustment = useAddDebtAdjustment();
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      creditAmount: 0,
      debtAmount: 0,
      isWorkshopAccount: false,
    },
  });

  useEffect(() => {
    if (client) {
      reset({
        name: client.name,
        phone: client.phone || '',
        email: client.email || '',
        creditAmount: client.creditAmount || 0,
        debtAmount: client.debtAmount || 0,
        isWorkshopAccount: client.isWorkshopAccount || false,
      });
    } else {
      reset({
        name: '',
        phone: '',
        email: '',
        creditAmount: 0,
        debtAmount: 0,
        isWorkshopAccount: false,
      });
    }
  }, [client, reset, isOpen]);

  const onSubmit = async (data: ClientFormData) => {
    try {
      if (client) {
        await updateClient.mutateAsync({ id: client.id, data });

        // Log credit adjustment if credit changed
        const originalCredit = client.creditAmount || 0;
        const newCredit = data.creditAmount || 0;
        const creditDelta = newCredit - originalCredit;
        if (creditDelta !== 0) {
          await addCreditAdjustment.mutateAsync({
            clientId: client.id,
            amount: creditDelta,
            reason: `Ajuste manual de credito (${originalCredit} -> ${newCredit})`,
            adjustedBy: user?.email || user?.displayName || 'unknown',
          });
        }

        // Log debt adjustment if debt changed
        const originalDebt = client.debtAmount || 0;
        const newDebt = data.debtAmount || 0;
        const debtDelta = newDebt - originalDebt;
        if (debtDelta !== 0) {
          await addDebtAdjustment.mutateAsync({
            clientId: client.id,
            amount: debtDelta,
            reason: `Ajuste manual de deuda (${originalDebt} -> ${newDebt})`,
            adjustedBy: user?.email || user?.displayName || 'unknown',
          });
        }
      } else {
        await createClient.mutateAsync(data);
      }
      onClose();
    } catch (error) {
      console.error(error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {client ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input {...register('name')} className="input-field" placeholder="Nombre del cliente" />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input {...register('phone')} className="input-field" placeholder="1234-5678" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              {...register('email')}
              className="input-field"
              placeholder="cliente@ejemplo.com"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Crédito Inicial
              </label>
              <input
                type="number"
                step="0.01"
                {...register('creditAmount', { valueAsNumber: true })}
                className="input-field"
              />
              {errors.creditAmount && (
                <p className="text-red-500 text-sm mt-1">{errors.creditAmount.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deuda Inicial</label>
              <input
                type="number"
                step="0.01"
                {...register('debtAmount', { valueAsNumber: true })}
                className="input-field"
              />
              {errors.debtAmount && (
                <p className="text-red-500 text-sm mt-1">{errors.debtAmount.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isWorkshop"
              {...register('isWorkshopAccount')}
              className="rounded border-gray-300 text-primary-600"
            />
            <label htmlFor="isWorkshop" className="text-sm text-gray-700">
              Cuenta de Taller (Mayorista)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : client ? 'Guardar Cambios' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
