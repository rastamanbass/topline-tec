import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { CATEGORIES, type Accessory } from '../hooks/useAccessories';

const schema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  category: z.string().min(1, 'Categoría requerida'),
  brand: z.string().optional(),
  costPrice: z.number().min(0, 'Costo inválido'),
  salePrice: z.number().min(0, 'Precio inválido'),
  stock: z.number().int().min(0, 'Stock inválido'),
  minStock: z.number().int().min(0, 'Stock mínimo inválido'),
  sku: z.string().optional(),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  initialData?: Accessory;
  onSubmit: (data: FormData) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export default function AccessoryForm({ initialData, onSubmit, onClose, isLoading }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      category: 'Cables',
      brand: '',
      costPrice: 0,
      salePrice: 0,
      stock: 0,
      minStock: 2,
      sku: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        category: initialData.category,
        brand: initialData.brand || '',
        costPrice: initialData.costPrice,
        salePrice: initialData.salePrice,
        stock: initialData.stock,
        minStock: initialData.minStock,
        sku: initialData.sku || '',
        isActive: initialData.isActive,
      });
    }
  }, [initialData, reset]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {initialData ? 'Editar Accesorio' : 'Nuevo Accesorio'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                {...register('name')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ej. Cable USB-C 1m"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Categoría *</label>
              <select
                {...register('category')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Marca</label>
              <input
                {...register('brand')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ej. Anker"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Costo (USD) *</label>
              <input
                type="number"
                step="0.01"
                {...register('costPrice', { valueAsNumber: true })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.costPrice && (
                <p className="text-xs text-red-500 mt-1">{errors.costPrice.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Precio Venta (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('salePrice', { valueAsNumber: true })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.salePrice && (
                <p className="text-xs text-red-500 mt-1">{errors.salePrice.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Stock Actual *</label>
              <input
                type="number"
                {...register('stock', { valueAsNumber: true })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.stock && <p className="text-xs text-red-500 mt-1">{errors.stock.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Stock Mínimo *</label>
              <input
                type="number"
                {...register('minStock', { valueAsNumber: true })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.minStock && (
                <p className="text-xs text-red-500 mt-1">{errors.minStock.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">SKU</label>
              <input
                {...register('sku')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ej. ACC-001"
              />
            </div>

            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="isActive"
                {...register('isActive')}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Producto activo
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Guardando...' : initialData ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
