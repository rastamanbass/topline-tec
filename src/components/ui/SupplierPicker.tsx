/**
 * SupplierPicker — Combobox / autocomplete para codigos internos de proveedor.
 *
 * Muestra los codigos disponibles (hardcoded + Firestore), filtra mientras
 * escribis, y si tipeas algo que no existe te pregunta si lo queres agregar.
 * Cuando hay un valor seleccionado, se renderiza como badge ambar con × para
 * limpiar.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { addInternalCode, useInternalCodes } from '../../lib/internalCodes';

export interface SupplierPickerProps {
  value: string | null;
  onChange: (code: string | null) => void;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
}

const sizeClasses = {
  sm: 'px-2.5 py-1.5 text-sm',
  md: 'px-3 py-2 text-sm',
} as const;

const badgeSizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
} as const;

export default function SupplierPicker({
  value,
  onChange,
  placeholder = 'Codigo de proveedor (ej: WNY, KRA)',
  className = '',
  size = 'md',
}: SupplierPickerProps) {
  const codes = useInternalCodes();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cierra el dropdown al click fuera.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return codes;
    return codes.filter((c) => c.includes(q));
  }, [codes, query]);

  const normalizedQuery = query.trim().toUpperCase();
  const queryIsExisting = !!normalizedQuery && codes.includes(normalizedQuery);
  const queryIsValidNew =
    !!normalizedQuery && !queryIsExisting && /^[A-Z0-9]{1,12}$/.test(normalizedQuery);

  function handleSelect(code: string) {
    onChange(code);
    setQuery('');
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setQuery('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!normalizedQuery) return;
      if (queryIsExisting) {
        handleSelect(normalizedQuery);
        return;
      }
      if (filtered.length === 1) {
        handleSelect(filtered[0]);
        return;
      }
      if (queryIsValidNew) {
        setConfirming(normalizedQuery);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  async function confirmAddNew() {
    if (!confirming) return;
    setAdding(true);
    try {
      await addInternalCode(confirming);
      toast.success(`Codigo "${confirming}" agregado`);
      onChange(confirming);
      setQuery('');
      setOpen(false);
      setConfirming(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error agregando codigo';
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  }

  // Render badge cuando hay valor seleccionado.
  if (value) {
    return (
      <div className={className}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border bg-amber-100 text-amber-800 border-amber-200 font-medium ${badgeSizeClasses[size]}`}
        >
          <span className="font-mono tracking-wide">{value}</span>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-full hover:bg-amber-200 transition-colors p-0.5 -mr-0.5"
            aria-label="Limpiar codigo de proveedor"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 font-mono uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 transition ${sizeClasses[size]}`}
        autoComplete="off"
        spellCheck={false}
      />

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
          {filtered.length === 0 && !queryIsValidNew && (
            <div className="px-3 py-2 text-sm text-gray-500">
              {normalizedQuery ? 'Codigo invalido (solo letras/numeros, 1-12)' : 'No hay codigos'}
            </div>
          )}

          {filtered.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => handleSelect(code)}
              className="w-full text-left px-3 py-2 text-sm font-mono tracking-wide hover:bg-amber-50 hover:text-amber-900 transition-colors"
            >
              {code}
            </button>
          ))}

          {queryIsValidNew && (
            <button
              type="button"
              onClick={() => setConfirming(normalizedQuery)}
              className="w-full text-left px-3 py-2 text-sm border-t border-gray-100 bg-gray-50 hover:bg-amber-50 transition-colors"
            >
              <span className="text-gray-700">Agregar nuevo codigo: </span>
              <span className="font-mono font-semibold text-amber-700">{normalizedQuery}</span>
            </button>
          )}
        </div>
      )}

      {/* Modal de confirmacion */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !adding && setConfirming(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nuevo codigo de proveedor</h3>
            <p className="text-sm text-gray-600 mb-5">
              {'\u00bf'}
              <span className="font-mono font-semibold text-amber-700">{confirming}</span> es un
              codigo de proveedor nuevo? Se guardara en Firestore y estara disponible para todo el
              equipo.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={adding}
                className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                No, cancelar
              </button>
              <button
                type="button"
                onClick={confirmAddNew}
                disabled={adding}
                className="px-4 py-2 text-sm rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition disabled:opacity-50"
              >
                {adding ? 'Agregando...' : 'Si, agregarlo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
