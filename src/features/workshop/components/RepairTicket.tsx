import { X, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePhones } from '../../inventory/hooks/usePhones';
import { useState } from 'react';
import { useAddRepairTicket } from '../hooks/useWorkshop';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context';

// Minimal definition for finding a phone to repair
const schema = z.object({
  note: z.string().min(3, 'Descripción requerida'),
  cost: z.number().min(0),
});

type RepairFormData = z.infer<typeof schema>;

export default function RepairTicket({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);

  // Reuse inventory phone search
  const { data: phones } = usePhones({ searchQuery });
  const { user } = useAuth();
  const addTicket = useAddRepairTicket();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RepairFormData>({
    resolver: zodResolver(schema),
    defaultValues: { cost: 0 },
  });

  const onSubmit = async (data: RepairFormData) => {
    if (!selectedPhoneId) {
      toast.error('Seleccione un teléfono');
      return;
    }

    try {
      await addTicket.mutateAsync({
        phoneId: selectedPhoneId,
        repair: {
          date: new Date(),
          note: data.note,
          cost: data.cost,
          paid: false,
          user: user?.email || 'unknown',
        },
      });
      toast.success('Reparación creada exitosamente');
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Error al crear la reparación');
    }
  };

  const filteredPhones = phones?.slice(0, 5); // Limit suggestions

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-lg shadow-xl">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-indigo-600">
            Nueva Orden de Reparación
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Phone Search */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Buscar Teléfono (IMEI / Modelo)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                className="pl-10 input-primary w-full"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedPhoneId(null); // Reset selection on type
                }}
              />
            </div>
            {/* Dropdown results */}
            {searchQuery && filteredPhones && !selectedPhoneId && (
              <ul className="border rounded-md max-h-40 overflow-auto bg-white shadow-lg absolute w-full z-10">
                {filteredPhones.map((p) => (
                  <li
                    key={p.id}
                    className="p-2 hover:bg-indigo-50 cursor-pointer border-b last:border-0"
                    onClick={() => {
                      setSelectedPhoneId(p.id);
                      setSearchQuery(`${p.marca} ${p.modelo} - ${p.imei}`);
                    }}
                  >
                    <div className="font-medium">
                      {p.marca} {p.modelo}
                    </div>
                    <div className="text-xs text-gray-500">
                      {p.imei} - {p.estado}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Descripción del Problema / Reparación
              </label>
              <textarea
                {...register('note')}
                className="input-primary w-full h-24 mt-1"
                placeholder="Cambio de pantalla, batería, etc..."
              />
              {errors.note && <p className="text-red-500 text-sm">{errors.note.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Costo Estimado ($)</label>
              <input
                type="number"
                step="0.01"
                {...register('cost', { valueAsNumber: true })}
                className="input-primary w-full mt-1"
              />
              {errors.cost && <p className="text-red-500 text-sm">{errors.cost.message}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedPhoneId}
              className="btn-primary"
            >
              {isSubmitting ? 'Guardando...' : 'Crear Orden'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
