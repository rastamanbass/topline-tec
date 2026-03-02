import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  ScanBarcode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  PackageCheck,
  Loader2,
  Truck,
  Hash,
  Calendar,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useReceivingSession } from '../../receiving/hooks/useReceivingSession';
import ActaReceptionModal from '../../receiving/components/ActaReceptionModal';
import { useMarkShipmentReceived } from '../hooks/useImportShipments';
import type { ImportShipment, Phone } from '../../../types';

// ── Beep sound via Web Audio API ──────────────────────────────────────────────
function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 330;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Browser may block audio without user gesture — silent fallback
  }
}

const STATUS_CONFIG = {
  ok: {
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    label: 'Recibido',
    row: 'bg-emerald-50 border-emerald-100',
  },
  duplicate: {
    icon: <RefreshCw className="w-5 h-5 text-gray-400" />,
    label: 'Duplicado',
    row: 'bg-gray-50 border-gray-100',
  },
  wrong_state: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    label: 'Estado incorrecto',
    row: 'bg-amber-50 border-amber-100',
  },
  not_found: {
    icon: <XCircle className="w-5 h-5 text-red-500" />,
    label: 'Desconocido',
    row: 'bg-red-50 border-red-100',
  },
};

interface Props {
  shipment: ImportShipment;
  onClose: () => void;
}

export default function ReceiveShipmentModal({ shipment, onClose }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [actaData, setActaData] = useState<{
    reportId: string;
    lote: string;
    receivedPhones: Phone[];
    missingImeis: string[];
  } | null>(null);

  const markReceived = useMarkShipmentReceived();

  const {
    expectedCount,
    okCount,
    missingPhones,
    scannedResults,
    processScan,
    closeReceiving,
    reset,
    isLoading: phonesLoading,
    isClosing,
  } = useReceivingSession(shipment.lote);

  const inputRef = useRef<HTMLInputElement>(null);
  const [inputBuffer, setInputBuffer] = useState('');

  const refocusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = useCallback(
    (raw: string) => {
      const result = processScan(raw);
      if (result === 'ignored') return;
      beep(result === 'ok');
      setInputBuffer('');
    },
    [processScan]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputBuffer.trim()) handleScan(inputBuffer);
    }
  };

  const handleClose = async () => {
    setShowConfirm(false);
    try {
      const result = await closeReceiving();
      if (result) {
        // Mark the import shipment as received
        await markReceived.mutateAsync({
          shipmentId: shipment.id,
          receivedCount: okCount,
          reportId: result.reportId,
        });
        toast.success(`Listo! ${okCount} teléfonos pasaron a En Stock.`);
        setActaData({
          reportId: result.reportId,
          lote: result.lote,
          receivedPhones: result.receivedPhones,
          missingImeis: result.missingImeis,
        });
      }
    } catch {
      toast.error('Error al cerrar la recepción. Intenta de nuevo.');
    }
  };

  const progressPct = expectedCount > 0 ? (okCount / expectedCount) * 100 : 0;
  const isComplete = expectedCount > 0 && okCount === expectedCount;

  // If acta is showing, render it on top
  if (actaData) {
    return (
      <ActaReceptionModal
        lote={actaData.lote}
        reportId={actaData.reportId}
        receivedPhones={actaData.receivedPhones}
        missingImeis={actaData.missingImeis}
        onDone={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col overflow-y-auto">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <PackageCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 truncate">{shipment.name}</h1>
              <p className="text-xs text-gray-400 truncate">Lote: {shipment.lote}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
        {/* Shipment info card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <Truck className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-gray-400 mb-0.5">Empresa</p>
                <p className="font-semibold text-gray-800">
                  {shipment.carrier === 'Otro'
                    ? (shipment.carrierCustomName || 'Otro')
                    : shipment.carrier === 'Persona'
                      ? `Persona: ${shipment.courierName || '—'}`
                      : shipment.carrier}
                </p>
              </div>
            </div>

            {shipment.trackingNumber ? (
              <div className="flex items-start gap-2">
                <Hash className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-gray-400 mb-0.5">Guía</p>
                  <p className="font-semibold text-gray-800 font-mono">{shipment.trackingNumber}</p>
                </div>
              </div>
            ) : null}

            {shipment.estimatedArrival ? (
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-gray-400 mb-0.5">Llegada est.</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(shipment.estimatedArrival + 'T12:00:00').toLocaleDateString('es-SV', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex items-start gap-2">
              <PackageCheck className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-gray-400 mb-0.5">Teléfonos</p>
                <p className="font-semibold text-gray-800">{shipment.phoneIds.length} esperados</p>
              </div>
            </div>
          </div>

          {shipment.notes && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-start gap-2">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-600 italic">{shipment.notes}</p>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Progreso · {shipment.lote}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-0.5">
                {okCount}
                <span className="text-xl text-gray-400 font-medium"> / {expectedCount}</span>
              </p>
              <p className="text-sm text-gray-500">
                {phonesLoading
                  ? 'Cargando...'
                  : expectedCount === 0
                    ? 'No hay teléfonos en tránsito para este lote'
                    : isComplete
                      ? 'Todos los teléfonos recibidos!'
                      : `Faltan ${expectedCount - okCount} por escanear`}
              </p>
            </div>
            {isComplete && <CheckCircle2 className="w-10 h-10 text-emerald-500" />}
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isComplete ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {scannedResults.length > 0 && (
            <div className="flex gap-4 mt-3 text-xs">
              <span className="text-emerald-600 font-medium">{okCount} OK</span>
              {scannedResults.filter((r) => r.status === 'not_found').length > 0 && (
                <span className="text-red-500 font-medium">
                  {scannedResults.filter((r) => r.status === 'not_found').length} desconocidos
                </span>
              )}
              {scannedResults.filter((r) => r.status === 'wrong_state').length > 0 && (
                <span className="text-amber-500 font-medium">
                  {scannedResults.filter((r) => r.status === 'wrong_state').length} estado
                  incorrecto
                </span>
              )}
              {scannedResults.filter((r) => r.status === 'duplicate').length > 0 && (
                <span className="text-gray-400 font-medium">
                  {scannedResults.filter((r) => r.status === 'duplicate').length} duplicados
                </span>
              )}
            </div>
          )}
        </div>

        {/* Scanner input */}
        <div
          className="bg-slate-900 rounded-2xl p-5 shadow-lg cursor-text"
          onClick={refocusInput}
        >
          <div className="flex items-center gap-3 mb-3">
            <ScanBarcode className="w-6 h-6 text-emerald-400 animate-pulse" />
            <p className="text-white font-semibold">Escáner activo</p>
            <span className="ml-auto text-xs text-slate-400">
              Pistola Bluetooth — apunta y dispara
            </span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputBuffer}
            onChange={(e) => setInputBuffer(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={refocusInput}
            className="w-full bg-slate-800 border border-slate-700 text-white text-2xl font-mono px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-600 tracking-widest"
            placeholder="_ _ _ _ _ _ _ _ _ _ _ _ _ _ _"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-slate-500 text-xs mt-2 text-center">
            El IMEI aparecerá aquí — presiona Enter o la pistola lo envía sola
          </p>
        </div>

        {/* Results list */}
        {scannedResults.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">
                Resultados ({scannedResults.length})
              </p>
              <button
                onClick={() => {
                  reset();
                  setInputBuffer('');
                  refocusInput();
                }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Limpiar
              </button>
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {scannedResults.map((r, i) => {
                const cfg = STATUS_CONFIG[r.status];
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-5 py-3 border-l-4 ${cfg.row}`}
                  >
                    <div className="shrink-0">{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {r.phoneInfo || cfg.label}
                      </p>
                      <p className="text-xs font-mono text-gray-400 truncate">
                        {r.imei}
                        {r.currentState ? ` · Estado: ${r.currentState}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium shrink-0 ${
                        r.status === 'ok'
                          ? 'text-emerald-600'
                          : r.status === 'not_found'
                            ? 'text-red-500'
                            : r.status === 'wrong_state'
                              ? 'text-amber-600'
                              : 'text-gray-400'
                      }`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Missing phones */}
        {missingPhones.length > 0 && scannedResults.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-red-50 bg-red-50">
              <p className="text-sm font-semibold text-red-700">
                Teléfonos faltantes ({missingPhones.length})
              </p>
              <p className="text-xs text-red-500">
                Estaban en tránsito pero no han sido escaneados
              </p>
            </div>
            <div className="divide-y divide-gray-50 max-h-40 overflow-y-auto">
              {missingPhones.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {p.marca} {p.modelo}
                      {p.storage ? ` · ${p.storage}` : ''}
                    </p>
                    <p className="text-xs font-mono text-gray-400">{p.imei}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        {okCount > 0 && (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-4 rounded-2xl text-lg shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <PackageCheck className="w-6 h-6" />
            Cerrar recepción · {okCount} teléfonos a stock
          </button>
        )}

        {/* Safety zone at bottom */}
        <div className="h-4" />
      </main>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-1">¿Cerrar recepción?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Envío: <strong>{shipment.name}</strong>
            </p>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Teléfonos a pasar a stock</span>
                <span className="font-bold text-emerald-600">{okCount}</span>
              </div>
              {missingPhones.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Teléfonos faltantes</span>
                  <span className="font-bold text-red-500">{missingPhones.length}</span>
                </div>
              )}
            </div>

            {missingPhones.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 mb-5">
                Hay teléfonos que no llegaron. Quedarán en "En Tránsito" para seguimiento.
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleClose}
                disabled={isClosing || markReceived.isPending}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isClosing || markReceived.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PackageCheck className="w-4 h-4" />
                )}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
