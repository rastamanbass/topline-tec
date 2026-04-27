import { useEffect, useMemo } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
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
import SupplierPicker from '../../../components/ui/SupplierPicker';
import { AlertTriangle, Hash, Smartphone, Truck, DollarSign } from 'lucide-react';

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

// ── Reusable shells ─────────────────────────────────────────────────────────
const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all';
const labelClass = 'text-xs font-medium text-gray-700 mb-1.5 block';
const errorClass = 'mt-1 text-xs text-red-600';

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className={labelClass}>
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
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
      supplierCode: null,
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
      setValue('supplierCode', selectedPhone.supplierCode || null);
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

  const onSubmit = async (data: PhoneFormData) => {
    try {
      // Resolve final supplierCode: explicit picker value takes precedence over
      // legacy parenthesis-stripping of marca/modelo.
      const splitResult = splitMarcaAndSupplier(data.marca, data.modelo);
      const finalSupplierCode = data.supplierCode || splitResult.supplierCode || null;
      const finalMarca = splitResult.marca;

      if (modalMode === 'create') {
        const imeis = data.imei
          .split('\n')
          .map((i) => i.trim())
          .filter((i) => i.length > 0);
        if (imeis.length === 0) {
          toast.error('Ingresa al menos un IMEI');
          return;
        }

        const promises = imeis.map((imei) =>
          createPhone.mutateAsync({
            ...data,
            condition: data.condition || 'Grade A',
            imei: imei,
            marca: finalMarca,
            supplierCode: finalSupplierCode,
          })
        );
        await Promise.all(promises);
      } else if (modalMode === 'edit' && selectedPhone) {
        await updatePhone.mutateAsync({
          id: selectedPhone.id,
          data: { ...data, marca: finalMarca, supplierCode: finalSupplierCode },
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

  const shortLines = (() => {
    if (modalMode !== 'create' || errors.imei) return [];
    const lines = imeiValue
      ? imeiValue
          .split('\n')
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 0)
      : [];
    return lines.filter((l: string) => l.length > 0 && l.length < 15);
  })();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 bg-gray-50">
      <div className="space-y-4">
        {/* ── Identificación ──────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <header className="flex items-center gap-2 mb-4">
            <Hash className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Identificación
            </h3>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FieldLabel htmlFor="imei" required>
                IMEI
              </FieldLabel>
              {modalMode === 'create' ? (
                <textarea
                  id="imei"
                  {...register('imei')}
                  className={`${inputClass} font-mono ${errors.imei ? 'border-red-400' : ''}`}
                  placeholder="Añadir uno o más IMEIs, uno por línea"
                  rows={4}
                />
              ) : (
                <input
                  id="imei"
                  type="text"
                  {...register('imei')}
                  className={`${inputClass} font-mono ${errors.imei ? 'border-red-400' : ''}`}
                  placeholder="123456789012345"
                  disabled
                />
              )}
              {errors.imei && <p className={errorClass}>{errors.imei.message}</p>}
              {shortLines.length > 0 && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2">
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
              )}
            </div>

            <div className="md:col-span-2">
              <FieldLabel htmlFor="lote" required>
                Lote
              </FieldLabel>
              <input
                id="lote"
                type="text"
                list="batches-list"
                {...register('lote')}
                className={`${inputClass} ${errors.lote ? 'border-red-400' : ''}`}
                placeholder="LOTE-2024-01"
                autoComplete="off"
              />
              <datalist id="batches-list">
                {batches.map((b) => (
                  <option key={b.id} value={b.name} />
                ))}
              </datalist>
              {errors.lote && <p className={errorClass}>{errors.lote.message}</p>}
            </div>
          </div>
        </section>

        {/* ── Equipo ──────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <header className="flex items-center gap-2 mb-4">
            <Smartphone className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Equipo</h3>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="marca" required>
                Marca
              </FieldLabel>
              <input
                id="marca"
                type="text"
                list="brands-list-manual"
                {...register('marca')}
                className={`${inputClass} ${errors.marca ? 'border-red-400' : ''}`}
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
              {errors.marca && <p className={errorClass}>{errors.marca.message}</p>}
            </div>

            <div>
              <FieldLabel htmlFor="modelo" required>
                Modelo
              </FieldLabel>
              <input
                id="modelo"
                type="text"
                list="models-list-manual"
                {...register('modelo')}
                className={`${inputClass} ${errors.modelo ? 'border-red-400' : ''}`}
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
              {errors.modelo && <p className={errorClass}>{errors.modelo.message}</p>}
            </div>

            <div>
              <FieldLabel htmlFor="storage">Capacidad / Almacenamiento</FieldLabel>
              <input
                id="storage"
                type="text"
                list="storage-list"
                {...register('storage')}
                className={inputClass}
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

            <div>
              <FieldLabel htmlFor="condition" required>
                Condición
              </FieldLabel>
              <select id="condition" {...register('condition')} className={inputClass}>
                <option value="New">New (Nuevo)</option>
                <option value="Open Box">Open Box</option>
                <option value="Grade A">Grade A (Excelente)</option>
                <option value="Grade B">Grade B (Bueno)</option>
                <option value="Grade C">Grade C (Detalles)</option>
              </select>
            </div>
          </div>
        </section>

        {/* ── Procedencia ─────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <header className="flex items-center gap-2 mb-4">
            <Truck className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Procedencia</h3>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Proveedor</FieldLabel>
              <Controller
                control={control}
                name="supplierCode"
                render={({ field }) => (
                  <SupplierPicker value={field.value || null} onChange={field.onChange} />
                )}
              />
              <p className="mt-1 text-xs text-gray-400">
                Codigo interno de Eduardo (WNY, KRA, etc). Opcional.
              </p>
            </div>

            <div>
              <FieldLabel htmlFor="estado" required>
                Estado inicial
              </FieldLabel>
              <select
                id="estado"
                {...register('estado')}
                className={`${inputClass} ${errors.estado ? 'border-red-400' : ''}`}
              >
                {PHONE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              {errors.estado && <p className={errorClass}>{errors.estado.message}</p>}
            </div>
          </div>
        </section>

        {/* ── Precio ──────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <header className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Precio</h3>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {showCosts && (
              <div>
                <FieldLabel htmlFor="costo" required>
                  Costo (USD)
                </FieldLabel>
                <input
                  id="costo"
                  type="number"
                  step="0.01"
                  {...register('costo', { valueAsNumber: true })}
                  className={`${inputClass} ${errors.costo ? 'border-red-400' : ''}`}
                  placeholder="500.00"
                />
                {errors.costo && <p className={errorClass}>{errors.costo.message}</p>}
              </div>
            )}

            <div className={showCosts ? '' : 'md:col-span-2'}>
              <FieldLabel htmlFor="precioVenta" required>
                Precio Venta (USD)
              </FieldLabel>
              <input
                id="precioVenta"
                type="number"
                step="0.01"
                {...register('precioVenta', { valueAsNumber: true })}
                className={`${inputClass} ${errors.precioVenta ? 'border-red-400' : ''}`}
                placeholder="650.00"
              />
              {errors.precioVenta && <p className={errorClass}>{errors.precioVenta.message}</p>}
            </div>
          </div>
        </section>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
        >
          {isSubmitting
            ? 'Guardando...'
            : modalMode === 'edit'
              ? 'Guardar cambios'
              : 'Crear teléfono'}
        </button>
      </div>
    </form>
  );
}
