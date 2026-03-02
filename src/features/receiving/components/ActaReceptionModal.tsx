import { useState, useRef, useCallback, useEffect } from 'react';
import { Printer, SkipForward, FileCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSaveReceptionAct } from '../hooks/useReceptionAct';
import { phoneLabel } from '../../../lib/phoneUtils';
import type { Phone } from '../../../types';

interface ActaReceptionModalProps {
  lote: string;
  reportId: string;
  receivedPhones: Phone[];
  missingImeis: string[];
  onDone: () => void;
}

export default function ActaReceptionModal({
  lote,
  reportId,
  receivedPhones,
  missingImeis,
  onDone,
}: ActaReceptionModalProps) {
  const [responsibleName, setResponsibleName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [actaId, setActaId] = useState<string | null>(null);
  const [actaGenerated, setActaGenerated] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const saveActa = useSaveReceptionAct();

  const now = new Date();
  const nowFormatted = new Intl.DateTimeFormat('es-SV', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);

  const actaNumber = `ACTA-${now.getFullYear()}-${reportId.slice(0, 6).toUpperCase()}`;

  // ── Canvas signature ──────────────────────────────────────────────────────

  const getCanvasPos = (
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const handleMouseDown = (e: MouseEvent) => {
      isDrawingRef.current = true;
      const pos = getCanvasPos(canvas, e.clientX, e.clientY);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      const pos = getCanvasPos(canvas, e.clientX, e.clientY);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasSignature(true);
    };

    const handleMouseUp = () => {
      isDrawingRef.current = false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      isDrawingRef.current = true;
      const touch = e.touches[0];
      const pos = getCanvasPos(canvas, touch.clientX, touch.clientY);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!isDrawingRef.current) return;
      const touch = e.touches[0];
      const pos = getCanvasPos(canvas, touch.clientX, touch.clientY);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasSignature(true);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      isDrawingRef.current = false;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }, []);

  const isSignatureBlank = (): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // Check if all pixels are white (255,255,255)
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
        return false; // Found a non-white pixel → has content
      }
    }
    return true;
  };

  // ── Generate Acta ─────────────────────────────────────────────────────────

  const handleGenerateActa = async () => {
    if (!responsibleName.trim()) {
      toast.error('Por favor ingresa el nombre del responsable.');
      return;
    }
    if (!confirmed) {
      toast.error('Debes confirmar la responsabilidad antes de generar el acta.');
      return;
    }
    if (isSignatureBlank()) {
      toast.error('La firma es requerida. Por favor firma en el espacio indicado.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureDataUrl = canvas.toDataURL('image/png');

    const actPhones = receivedPhones.map((p) => ({
      id: p.id,
      imei: p.imei,
      marca: p.marca,
      modelo: p.modelo,
      storage: p.storage,
      condition: p.condition,
    }));

    try {
      const id = await saveActa.mutateAsync({
        lote,
        reportId,
        receivedAt: new Date() as unknown,
        receivedByEmail: '', // filled by hook
        responsibleName: responsibleName.trim(),
        signatureDataUrl,
        phones: actPhones,
        totalReceived: receivedPhones.length,
        totalMissing: missingImeis.length,
        missingImeis,
        status: 'signed',
      });
      setActaId(id);
      setActaGenerated(true);
      toast.success('Acta generada y guardada exitosamente.');

      // Auto-navigate after 3 seconds if user doesn't click
      setTimeout(() => {
        onDone();
      }, 3000);
    } catch (err) {
      toast.error(`Error al guardar el acta: ${(err as Error).message}`);
    }
  };

  const canGenerate = responsibleName.trim().length > 0 && confirmed && hasSignature;

  return (
    <>
      {/* Screen modal */}
      <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 print:hidden">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <p className="text-xs font-bold text-primary-600 uppercase tracking-widest">
                TOP LINE TEC
              </p>
              <h2 className="text-lg font-bold text-gray-900">Acta de Recepcion — {lote}</h2>
            </div>
            {actaGenerated ? (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            ) : (
              <p className="text-xs text-gray-400">{actaNumber}</p>
            )}
          </div>

          <div className="p-6 space-y-5">
            {/* Info section */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">Lote</p>
                <p className="font-bold text-gray-900">{lote}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">Recibidos</p>
                <p className="font-bold text-emerald-700">{receivedPhones.length}</p>
              </div>
              {missingImeis.length > 0 && (
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Faltantes</p>
                  <p className="font-bold text-red-700">{missingImeis.length}</p>
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-3 col-span-2 sm:col-span-1">
                <p className="text-xs text-gray-400 mb-0.5">Fecha</p>
                <p className="font-medium text-gray-700 text-xs leading-tight">{nowFormatted}</p>
              </div>
            </div>

            {/* Phone table */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Equipos recibidos ({receivedPhones.length})
              </p>
              <div className="rounded-xl border border-gray-100 overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">
                        IMEI (ultimos 6)
                      </th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Modelo</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Storage</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Condicion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {receivedPhones.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 font-mono text-gray-700">
                          {p.imei.slice(-6)}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {phoneLabel(p.marca, p.modelo)}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{p.storage || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{p.condition || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Responsible Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nombre completo del responsable <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Nombre y apellido del receptor"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                disabled={actaGenerated}
              />
            </div>

            {/* Signature canvas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Firma digital <span className="text-red-500">*</span>
                </label>
                {!actaGenerated && (
                  <button
                    onClick={clearSignature}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Limpiar
                  </button>
                )}
              </div>
              <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-white">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={150}
                  className="w-full touch-none cursor-crosshair"
                  style={{ maxHeight: '150px' }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {hasSignature
                  ? 'Firma capturada. Usa "Limpiar" para volver a firmar.'
                  : 'Dibuja tu firma con el dedo o el mouse.'}
              </p>
            </div>

            {/* Confirmation checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                disabled={actaGenerated}
              />
              <span className="text-sm text-gray-700">
                Confirmo que me hago responsable de los{' '}
                <strong>{receivedPhones.length} equipos</strong> listados en este acta.
              </span>
            </label>

            {/* Actions */}
            {!actaGenerated ? (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleGenerateActa}
                  disabled={!canGenerate || saveActa.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors"
                >
                  {saveActa.isPending ? (
                    <span className="animate-spin">⌛</span>
                  ) : (
                    <FileCheck className="w-4 h-4" />
                  )}
                  Generar Acta
                </button>
                <button
                  onClick={onDone}
                  className="flex items-center gap-2 px-4 py-3 text-gray-400 hover:text-gray-600 rounded-xl text-sm transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                  Saltar
                </button>
              </div>
            ) : (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Acta
                </button>
                <button
                  onClick={onDone}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors"
                >
                  Continuar al Inventario
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print-only version */}
      {actaGenerated && actaId && (
        <div className="hidden print:block p-8 font-sans text-gray-900">
          {/* Print Header */}
          <div className="text-center mb-8 border-b-2 border-gray-900 pb-6">
            <h1 className="text-2xl font-black tracking-tight">TOP LINE TEC</h1>
            <p className="text-sm text-gray-500">Miami, FL, USA</p>
            <h2 className="text-lg font-bold mt-3 uppercase tracking-wider">
              Acta de Recepcion de Mercancia
            </h2>
            <p className="text-sm text-gray-600 mt-1">No. de Acta: {actaNumber}</p>
          </div>

          {/* Print Info */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p>
                <strong>Fecha:</strong> {nowFormatted}
              </p>
              <p>
                <strong>Lote:</strong> {lote}
              </p>
              <p>
                <strong>Total recibido:</strong> {receivedPhones.length} equipos
              </p>
              {missingImeis.length > 0 && (
                <p>
                  <strong>Total faltante:</strong> {missingImeis.length} equipos
                </p>
              )}
            </div>
            <div>
              <p>
                <strong>Responsable:</strong> {responsibleName}
              </p>
              <p>
                <strong>ID Reporte:</strong> {reportId}
              </p>
            </div>
          </div>

          {/* Print Table */}
          <table className="w-full text-xs border-collapse mb-8">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">IMEI (ultimos 6)</th>
                <th className="text-left px-3 py-2">Modelo</th>
                <th className="text-left px-3 py-2">Almacenamiento</th>
                <th className="text-left px-3 py-2">Condicion</th>
              </tr>
            </thead>
            <tbody>
              {receivedPhones.map((p, idx) => (
                <tr key={p.id} className="border-b border-gray-200">
                  <td className="px-3 py-1.5 text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-1.5 font-mono">{p.imei.slice(-6)}</td>
                  <td className="px-3 py-1.5 font-medium">{phoneLabel(p.marca, p.modelo)}</td>
                  <td className="px-3 py-1.5">{p.storage || '—'}</td>
                  <td className="px-3 py-1.5">{p.condition || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signature section */}
          <div className="mt-8 border-t-2 border-gray-300 pt-6">
            <p className="text-sm mb-4">
              El abajo firmante se hace responsable de haber recibido los{' '}
              <strong>{receivedPhones.length} equipos</strong> listados en el presente documento.
            </p>
            <div className="flex justify-between items-end mt-6">
              <div>
                <canvas
                  ref={canvasRef}
                  className="border border-gray-300"
                  style={{ width: '300px', height: '100px' }}
                />
                <div className="border-t border-gray-400 pt-1 mt-1">
                  <p className="font-bold text-sm">{responsibleName}</p>
                  <p className="text-xs text-gray-500">Receptor</p>
                </div>
              </div>
              <div className="text-xs text-gray-400 text-right">
                <p>{actaNumber}</p>
                <p>{nowFormatted}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accessible ID display */}
      {actaId && <span className="sr-only" data-acta-id={actaId} />}
    </>
  );
}

/**
 * SISTEMA 1 VERIFICADO:
 * ✅ Canvas de firma manual sin libreria externa
 * ✅ Validacion: nombre, firma y checkbox requeridos
 * ✅ Guarda en Firestore (receptionActs)
 * ✅ Vista de impresion limpia
 * ✅ Boton "Saltar" para emergencias
 * ✅ Auto-navega despues de 3 segundos al completar
 * ✅ Edge case: canvas blanco detectado via getImageData
 */
