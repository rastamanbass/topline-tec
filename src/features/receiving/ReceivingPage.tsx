import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ScanBarcode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  PackageCheck,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTransitLotes, useReceivingSession } from './hooks/useReceivingSession';
import ActaReceptionModal from './components/ActaReceptionModal';
import type { Phone } from '../../types';

// ── Beep sound via Web Audio API ─────────────────────────────────────────────
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

// ── Status helpers ────────────────────────────────────────────────────────────
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReceivingPage() {
  const navigate = useNavigate();
  const [selectedLote, setSelectedLote] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Acta modal state
  const [actaData, setActaData] = useState<{
    reportId: string;
    lote: string;
    receivedPhones: Phone[];
    missingImeis: string[];
  } | null>(null);

  const { lotes, isLoading: lotesLoading } = useTransitLotes();
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
  } = useReceivingSession(selectedLote);

  const inputRef = useRef<HTMLInputElement>(null);
  const [inputBuffer, setInputBuffer] = useState('');

  // Keep scanner input always focused
  const refocusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (selectedLote) inputRef.current?.focus();
  }, [selectedLote]);

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

  const handleLoteChange = (lote: string) => {
    setSelectedLote(lote);
    reset();
    setInputBuffer('');
  };

  const handleClose = async () => {
    setShowConfirm(false);
    try {
      const result = await closeReceiving();
      if (result) {
        toast.success(`Listo! ${okCount} telefonos pasaron a En Stock.`);
        // Show the Acta modal instead of navigating immediately
        setActaData({
          reportId: result.reportId,
          lote: result.lote,
          receivedPhones: result.receivedPhones,
          missingImeis: result.missingImeis,
        });
      }
    } catch {
      toast.error('Error al cerrar la recepcion. Intenta de nuevo.');
    }
  };

  const progressPct = expectedCount > 0 ? (okCount / expectedCount) * 100 : 0;
  const isComplete = expectedCount > 0 && okCount === expectedCount;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-primary-600" />
            <h1 className="text-lg font-bold text-gray-900">Recepcion de Envios</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
        {/* Step 1: Select lote */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Selecciona el lote que acaba de llegar:
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Solo aparecen lotes con equipos pendientes de recepcion
          </p>
          {lotesLoading ? (
            <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
          ) : lotes.length === 0 ? (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
              No hay lotes en transito en este momento.
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedLote}
                onChange={(e) => handleLoteChange(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              >
                <option value="">— Selecciona un lote —</option>
                {lotes.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Step 2+: Scanner + progress (only shown once a lote is selected) */}
        {selectedLote && (
          <>
            {/* Progress */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                    Progreso · {selectedLote}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-0.5">
                    {okCount}
                    <span className="text-xl text-gray-400 font-medium"> / {expectedCount}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    {phonesLoading
                      ? 'Cargando...'
                      : isComplete
                        ? 'Todos los telefonos recibidos!'
                        : `Faltan ${expectedCount - okCount} por escanear`}
                  </p>
                </div>
                {isComplete && <CheckCircle2 className="w-10 h-10 text-emerald-500" />}
              </div>
              {/* Progress bar */}
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isComplete ? 'bg-emerald-500' : 'bg-primary-500'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {/* Mini stats */}
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
                <p className="text-white font-semibold">Escaner activo</p>
                <span className="ml-auto text-xs text-slate-400">
                  Apunta y dispara con tu pistola Bluetooth
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
                El IMEI aparecera aqui — presiona Enter o la pistola lo envia sola
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

            {/* Missing phones (if any) */}
            {missingPhones.length > 0 && scannedResults.length > 0 && (
              <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-red-50 bg-red-50">
                  <p className="text-sm font-semibold text-red-700">
                    Telefonos faltantes ({missingPhones.length})
                  </p>
                  <p className="text-xs text-red-500">
                    Estaban en transito pero no han sido escaneados
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
                Cerrar recepcion · {okCount} telefonos a stock
              </button>
            )}
          </>
        )}
      </main>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Cerrar recepcion?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Lote: <strong>{selectedLote}</strong>
            </p>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Telefonos a pasar a stock</span>
                <span className="font-bold text-emerald-600">{okCount}</span>
              </div>
              {missingPhones.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Telefonos faltantes</span>
                  <span className="font-bold text-red-500">{missingPhones.length}</span>
                </div>
              )}
              {scannedResults.filter((r) => r.status === 'not_found').length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IMEIs desconocidos</span>
                  <span className="font-bold text-amber-500">
                    {scannedResults.filter((r) => r.status === 'not_found').length}
                  </span>
                </div>
              )}
            </div>

            {missingPhones.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 mb-5">
                Hay telefonos que no llegaron. Quedaran en estado "En Transito" para seguimiento.
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
                disabled={isClosing}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isClosing ? (
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

      {/* Acta de Recepcion Modal */}
      {actaData && (
        <ActaReceptionModal
          lote={actaData.lote}
          reportId={actaData.reportId}
          receivedPhones={actaData.receivedPhones}
          missingImeis={actaData.missingImeis}
          onDone={() => {
            setActaData(null);
            navigate('/inventory');
          }}
        />
      )}
    </div>
  );
}
