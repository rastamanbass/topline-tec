/**
 * AddSupplierModal — Simple modal to add a new supplier with name + code.
 */

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useQueryClient } from '@tanstack/react-query';
import { SUPPLIERS_QUERY_KEY } from '../../supplier-invoices/hooks/useSuppliers';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

export default function AddSupplierModal({ onClose }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    const trimName = name.trim();
    const trimCode = code.trim().toUpperCase();

    if (!trimName) {
      toast.error('Ingresa el nombre del proveedor');
      return;
    }
    if (!trimCode) {
      toast.error('Ingresa el codigo del proveedor');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'suppliers'), {
        name: trimName,
        code: trimCode,
        invoiceCount: 0,
        totalPhonesPurchased: 0,
        autoSeeded: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      toast.success('Proveedor creado');
      onClose();
    } catch {
      toast.error('Error al crear proveedor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Agregar Proveedor</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del proveedor"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Codigo
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WNY, XT, ZK, etc."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Este codigo debe coincidir con el valor que Eduardo usa en el campo &quot;marca&quot; al ingresar telefonos manualmente
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !code.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
