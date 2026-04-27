import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { phoneSchema, type PhoneFormData } from '../validation/phoneSchema';
import { useInventoryStore } from '../stores/inventoryStore';
import { useCreatePhone, useUpdatePhone } from '../hooks/usePhones';
import { deviceCatalog } from '../../../data/deviceCatalog';
import { useDeviceDefinition } from '../hooks/useDeviceDefinition';
import { useBatches } from '../hooks/useBatches';
import type { PhoneStatus } from '../../../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context';
import { canViewCosts } from '../../../lib/permissions';
import {
  normalizeDisplayBrand,
  normalizeStorage,
  normalizeIPhoneModel,
  splitMarcaAndSupplier,
} from '../../../lib/phoneUtils';
import { AlertTriangle } from 'lucide-react';

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

interface ManualFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

export default function ManualForm({ onCancel, onSuccess }: ManualFormProps) {
  const { modalMode, selectedPhone } = useInventoryStore();
  const createPhone = useCreatePhone();
  const updatePhone = useUpdatePhone();
  const { user, userRole } = useAuth();
  const showCosts = useMemo(() => canViewCosts(user?.email), [user?.email]);
  const { batches } = useBatches();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      imei: '',
      marca: '',
      modelo: '',
      lote: '',
      storage: '',
      costo: 0,
      precioVenta: 0,
      // Admins (Eduardo) cargan teléfonos en camino → directo a En Tránsito.
      // Marta los ve en /receiving en tiempo real (onSnapshot) y los recibe a Stock.
      estado:
        userRole === 'admin' ? 'En Tránsito (a El Salvador)' : 'En Stock (Disponible para Venta)',
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

  // --- SMART LEARNING: Auto-Detect ---
  const imeiValue = useWatch({ control, name: 'imei' });
  const firstImei = imeiValue ? imeiValue.split('\n')[0].trim() : '';
  const { definition } = useDeviceDefinition(firstImei);

  useEffect(() => {
    if (modalMode === 'create' && definition) {
      setValue('marca', definition.brand);
      setValue('modelo', definition.model);
    }
  }, [definition, modalMode, setValue]);

  // --- SMART PRICING: Auto-Suggest ---
  const wBrand = useWatch({ control, name: 'marca' });
  const wModel = useWatch({ control, name: 'modelo' });
  const wStorage = useWatch({ control, name: 'storage' });

  useEffect(() => {
    const fetchSuggestedPrice = async () => {
      if (modalMode === 'create' && wBrand && wModel) {
        const displayBrand = normalizeDisplayBrand(wBrand);
        const storageVal = normalizeStorage(wStorage);
        const normalizedModel =
          displayBrand === 'Apple' ? normalizeIPhoneModel(wModel || '') : wModel || 'Unknown';
        const safeId = `${displayBrand}-${normalizedModel}-${storageVal}`
          .replace(/\//g, '-')
          .replace(/\s+/g, '-')
          .toLowerCase();
        try {
          const snap = await getDoc(doc(db, 'price_catalog', safeId));
          if (snap.exists()) {
            const data = snap.data();
            if (data.averagePrice) {
              setValue('precioVenta', data.averagePrice);
              // Optional: Toast or small indicator?
            }
          }
        } catch {
          /* ignore */
        }
      }
    };
    const timer = setTimeout(fetchSuggestedPrice, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [wBrand, wModel, wStorage, modalMode, setValue]);
  // -----------------------------------
  // -----------------------------------

  const onSubmit = async (data: PhoneFormData) => {
    try {
      if (modalMode === 'create') {
        const imeis = data.imei
          .split('\n')
          .map((i) => i.trim())
          .filter((i) => i.length > 0);
        if (imeis.length === 0) {
          toast.error('Ingresa al menos un IMEI');
          return;
        }

        const { marca: finalMarca, supplierCode } = splitMarcaAndSupplier(data.marca, data.modelo);

        const promises = imeis.map((imei) =>
          createPhone.mutateAsync({
            ...data,
            condition: data.condition || 'Grade A',
            imei: imei,
            marca: finalMarca,
            supplierCode: supplierCode,
          })
        );
        await Promise.all(promises);
      } else if (modalMode === 'edit' && selectedPhone) {
        const { marca: finalMarca, supplierCode } = splitMarcaAndSupplier(data.marca, data.modelo);
        await updatePhone.mutateAsync({
          id: selectedPhone.id,
          data: { ...data, marca: finalMarca, supplierCode: supplierCode },
          previousEstado: selectedPhone.estado,
        });
      }
      onSuccess();
      reset();
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('Error al guardar el teléfono. Intenta de nuevo.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      {/* IMEI */}
      <div>
        <label htmlFor="imei" className="block text-sm font-medium text-gray-700 mb-1">
          IMEI <span className="text-red-500">*</span>
        </label>
        {modalMode === 'create' ? (
          <textarea
            id="imei"
            {...register('imei')}
            className={`input-field ${errors.imei ? 'border-red-500' : ''}`}
            placeholder="Añadir uno o más IMEIs, uno por línea"
            rows={4}
          />
        ) : (
          <input
            id="imei"
            type="text"
            {...register('imei')}
            className={`input-field ${errors.imei ? 'border-red-500' : ''}`}
            placeholder="123456789012345"
            disabled
          />
        )}
        {errors.imei && <p className="mt-1 text-sm text-red-600">{errors.imei.message}</p>}
        {/* Short IMEI warning for Eduardo */}
        {modalMode === 'create' &&
          !errors.imei &&
          (() => {
            const lines = imeiValue
              ? imeiValue
                  .split('\n')
                  .map((l: string) => l.trim())
                  .filter((l: string) => l.length > 0)
              : [];
            const shortLines = lines.filter((l: string) => l.length > 0 && l.length < 15);
            return shortLines.length > 0 ? (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Brother, por favor meter el numero de IMEI completo para un correcto registro
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    {shortLines.length} IMEI(s) con menos de 15 dígitos:{' '}
                    {shortLines.map((l: string) => `"${l}"`).join(', ')}
                  </p>
                </div>
              </div>
            ) : null;
          })()}
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
            list="brands-list-manual"
            {...register('marca')}
            className={`input-field ${errors.marca ? 'border-red-500' : ''}`}
            placeholder="Apple, Samsung, etc."
            autoComplete="off"
          />
          <datalist id="brands-list-manual">
            {Array.from(new Set(deviceCatalog.map((d) => d.brand)))
              .sort()
              .map((brand) => (
                <option key={brand} value={brand} />
              ))}
          </datalist>
          {errors.marca && <p className="mt-1 text-sm text-red-600">{errors.marca.message}</p>}
        </div>

        <div>
          <label htmlFor="modelo" className="block text-sm font-medium text-gray-700 mb-1">
            Modelo <span className="text-red-500">*</span>
          </label>
          <input
            id="modelo"
            type="text"
            list="models-list-manual"
            {...register('modelo')}
            className={`input-field ${errors.modelo ? 'border-red-500' : ''}`}
            placeholder="iPhone 15 Pro Max"
            autoComplete="off"
          />
          <datalist id="models-list-manual">
            {deviceCatalog.map((d) => (
              <option key={`${d.brand}-${d.model}`} value={d.model}>
                {d.brand}
              </option>
            ))}
          </datalist>
          {errors.modelo && <p className="mt-1 text-sm text-red-600">{errors.modelo.message}</p>}
        </div>

        {/* Storage Field */}
        <div className="sm:col-span-2">
          <label htmlFor="storage" className="block text-sm font-medium text-gray-700 mb-1">
            Capacidad / Almacenamiento
          </label>
          <input
            id="storage"
            type="text"
            list="storage-list"
            {...register('storage')}
            className="input-field"
            placeholder="128GB, 256GB..."
          />
          <datalist id="storage-list">
            <option value="64GB" />
            <option value="128GB" />
            <option value="256GB" />
            <option value="512GB" />
            <option value="1TB" />
          </datalist>
        </div>
      </div>

      {/* Lote and Condition */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="lote" className="block text-sm font-medium text-gray-700 mb-1">
            Lote <span className="text-red-500">*</span>
          </label>
          <input
            id="lote"
            type="text"
            list="batches-list"
            {...register('lote')}
            className={`input-field ${errors.lote ? 'border-red-500' : ''}`}
            placeholder="LOTE-2024-01"
            autoComplete="off"
          />
          <datalist id="batches-list">
            {batches.map((b) => (
              <option key={b.id} value={b.name} />
            ))}
          </datalist>
          {errors.lote && <p className="mt-1 text-sm text-red-600">{errors.lote.message}</p>}
        </div>

        {/* Condition */}
        <div>
          <label htmlFor="condition" className="block text-sm font-medium text-gray-700 mb-1">
            Condición <span className="text-red-500">*</span>
          </label>
          <select id="condition" {...register('condition')} className="input-field">
            <option value="New">New (Nuevo)</option>
            <option value="Open Box">Open Box</option>
            <option value="Grade A">Grade A (Excelente)</option>
            <option value="Grade B">Grade B (Bueno)</option>
            <option value="Grade C">Grade C (Detalles)</option>
          </select>
        </div>
      </div>

      {/* Costo and Precio Venta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {showCosts && (
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
        )}

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
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={isSubmitting}>
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
  );
}
