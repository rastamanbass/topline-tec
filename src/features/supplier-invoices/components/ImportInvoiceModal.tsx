/**
 * ImportInvoiceModal — 3-step wizard to import supplier invoices (Excel or PDF)
 * Step 1: Upload & supplier selection
 * Step 2: Column mapping (Excel only, when columns not auto-detected)
 * Step 3: Preview & import configuration
 */

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import {
  X,
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import type { PhoneStatus, SupplierInvoiceItem, SupplierImportTemplate } from '../../../types';
import { parseExcelFile } from '../utils/excelParser';
import { detectColumnMappings, detectColumnType, getConfidence } from '../utils/columnDetector';
import { normalizePhoneDescription } from '../utils/phoneNameNormalizer';
import { validateIMEI, coerceIMEI } from '../utils/imeiValidator';
import { normalizeDisplayBrand, normalizeStorage, normalizeIPhoneModel, splitMarcaAndSupplier } from '../../../lib/phoneUtils';
import { useSuppliers, useCreateSupplier } from '../hooks/useSuppliers';
import { useImportSupplierInvoice } from '../hooks/useSupplierInvoices';
import { useBatches } from '../../inventory/hooks/useBatches';
import type { ParsedSheet } from '../utils/excelParser';
import type { StandardField } from '../utils/columnDetector';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

type WizardStep = 1 | 2 | 3 | 'pricing' | 'success';

interface PriceGroup {
  key: string;           // "marca|modelo|storage"
  marca: string;
  modelo: string;
  storage: string;
  units: number;
  unitCost: number;
  suggestedPrice: number;
  source: 'catalog' | 'auto';
  finalPrice: number;
}

interface FileDetection {
  fileType: 'excel' | 'pdf';
  hasIMEIs: boolean;
  rowCount: number;
  imeiCount: number;
  parsedSheet?: ParsedSheet;
  columnMappings?: Record<string, string>;
  allMapped?: boolean;
}

interface MappingRow {
  header: string;
  sample: string;
  detectedField: StandardField;
  userField: StandardField;
  confidence: 'high' | 'medium' | 'none';
}

const FIELD_LABELS: Record<string, string> = {
  imei: 'IMEI',
  make: 'Marca',
  model: 'Modelo',
  storage: 'Storage',
  carrier: 'Carrier',
  fullModel: 'Modelo Completo',
  unitPrice: 'Precio Unitario',
  qty: 'Cantidad',
  boxNumber: 'Número de Caja',
  trackingNumber: 'Número de Rastreo',
};

const INITIAL_STATUS_OPTIONS: PhoneStatus[] = [
  'En Bodega (USA)',
  'En Tránsito (a El Salvador)',
];

// ── Helper: build invoice items from parsed sheet ─────────────────────────────

function buildInvoiceItems(
  sheet: ParsedSheet,
  mappings: Record<string, string>
): SupplierInvoiceItem[] {
  // Invert mappings: field → header
  const fieldToHeader: Record<string, string> = {};
  for (const [header, field] of Object.entries(mappings)) {
    fieldToHeader[field] = header;
  }

  return sheet.rows.map((row, idx): SupplierInvoiceItem => {
    const getVal = (field: string) => {
      const header = fieldToHeader[field];
      return header ? row[header] : undefined;
    };

    // IMEI
    const rawImei = getVal('imei');
    const imeiStr = rawImei != null ? coerceIMEI(rawImei) : null;
    const imeiValid = imeiStr ? validateIMEI(imeiStr) : undefined;

    // Make / Model / Storage / Carrier from direct columns
    const make = getVal('make') != null ? String(getVal('make')).trim() : undefined;
    const model = getVal('model') != null ? String(getVal('model')).trim() : undefined;
    const storage = getVal('storage') != null ? String(getVal('storage')).trim() : undefined;
    const carrier = getVal('carrier') != null ? String(getVal('carrier')).trim() : undefined;

    // Full model / description for normalization
    const fullModelRaw = getVal('fullModel') ?? getVal('description');
    const fullModel = fullModelRaw != null ? String(fullModelRaw).trim() : undefined;

    // Price / qty
    const rawPrice = getVal('unitPrice');
    const unitPrice = rawPrice != null ? parseFloat(String(rawPrice).replace(/[$,]/g, '')) : undefined;
    const rawQty = getVal('qty');
    const qty = rawQty != null ? Math.max(1, parseInt(String(rawQty), 10) || 1) : 1;

    // Normalize description if we have one
    const descriptionToNormalize = fullModel || `${make || ''} ${model || ''}`.trim();
    const normalized = descriptionToNormalize
      ? normalizePhoneDescription(descriptionToNormalize)
      : null;

    // Determine type
    let type: SupplierInvoiceItem['type'];
    if (normalized) {
      type = normalized.type;
    } else if (imeiStr) {
      type = 'phone';
    } else {
      type = 'unknown';
    }

    const rawMarca = normalized?.marca || make;
    const rawModelo = normalized?.modelo || model || fullModel;
    const { marca: resolvedMarca, supplierCode } = splitMarcaAndSupplier(rawMarca, rawModelo);

    return {
      rowIndex: idx,
      imei: imeiStr || undefined,
      imeiValid,
      make: make || normalized?.marca,
      model: model || normalized?.modelo,
      storage: storage || normalized?.storage,
      carrier: carrier || normalized?.carrier,
      fullModel,
      unitPrice: !isNaN(unitPrice ?? NaN) ? unitPrice : undefined,
      qty,
      type,
      resolvedMarca,
      resolvedModelo: rawModelo,
      supplierCode,
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportInvoiceModal({ onClose }: Props) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>(1);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [detection, setDetection] = useState<FileDetection | null>(null);
  const [detecting, setDetecting] = useState(false);

  // Supplier selection
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [isNewSupplier, setIsNewSupplier] = useState(false);

  // Column mapping (step 2)
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [saveTemplate, setSaveTemplate] = useState(true);
  const [finalMappings, setFinalMappings] = useState<Record<string, string>>({});

  // Preview / import config (step 3)
  const [invoiceItems, setInvoiceItems] = useState<SupplierInvoiceItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [loteName, setLoteName] = useState('');
  const [costPerUnit, setCostPerUnit] = useState(0);
  const [initialStatus, setInitialStatus] = useState<PhoneStatus>('En Bodega (USA)');
  const [showAllRows, setShowAllRows] = useState(false);
  const [successLote, setSuccessLote] = useState('');
  const [successCount, setSuccessCount] = useState(0);

  // Pricing review step
  const [priceGroups, setPriceGroups] = useState<PriceGroup[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const pendingImportRef = useRef<{
    supplierId: string;
    supplierName: string;
    template: SupplierImportTemplate | undefined;
  } | null>(null);

  const { data: suppliers = [] } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const importInvoice = useImportSupplierInvoice();
  const { batches: existingBatches } = useBatches();

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setDetecting(true);
    try {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      const isExcel = ['xlsx', 'xls', 'csv'].includes(ext);
      const isPdf = ext === 'pdf';

      if (isExcel) {
        const sheet = await parseExcelFile(f);
        const sampleRows = sheet.rawRows.slice(sheet.headerRowIndex + 1, sheet.headerRowIndex + 6);
        const mappings = detectColumnMappings(sheet.headers, sampleRows as unknown[][]);

        // Count IMEIs in data
        const imeiHeader = Object.entries(mappings).find(([, f]) => f === 'imei')?.[0];
        let imeiCount = 0;
        if (imeiHeader) {
          imeiCount = sheet.rows.filter((row) => {
            const v = row[imeiHeader];
            return v != null && coerceIMEI(v) !== null;
          }).length;
        }

        const hasIMEIs = imeiCount > 0;

        // Check if all important columns are mapped
        const hasFullModel = !!Object.values(mappings).find((f) => f === 'fullModel' || f === 'make');
        const allMapped = hasIMEIs ? hasFullModel : hasFullModel;

        setDetection({
          fileType: 'excel',
          hasIMEIs,
          rowCount: sheet.rows.length,
          imeiCount,
          parsedSheet: sheet,
          columnMappings: mappings,
          allMapped,
        });
      } else if (isPdf) {
        // PDF: treated as pending arrival (no IMEIs)
        setDetection({
          fileType: 'pdf',
          hasIMEIs: false,
          rowCount: 0,
          imeiCount: 0,
        });
      } else {
        throw new Error('Formato no soportado. Usa .xlsx, .xls, .csv, o .pdf');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al leer el archivo';
      alert(msg);
      setFile(null);
      setDetection(null);
    } finally {
      setDetecting(false);
    }
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  // ── Step 1 → advance ───────────────────────────────────────────────────────

  const getOrCreateSupplierId = async (): Promise<string> => {
    if (!isNewSupplier && selectedSupplierId) return selectedSupplierId;
    if (isNewSupplier && newSupplierName.trim()) {
      const id = await createSupplier.mutateAsync({ name: newSupplierName.trim() });
      return id;
    }
    throw new Error('Selecciona o crea un proveedor');
  };

  const handleStep1Next = async () => {
    if (!file || !detection) return;

    try {
      const supplierId = await getOrCreateSupplierId();
      const supplierName = isNewSupplier
        ? newSupplierName.trim()
        : suppliers.find((s) => s.id === supplierId)?.name || '';

      // Auto-fill invoice number from file name
      const numMatch = file.name.match(/\d{4,}/);
      const autoNumber = numMatch ? numMatch[0] : file.name.replace(/\.[^.]+$/, '');
      setInvoiceNumber(autoNumber);
      // Only auto-fill lote if user hasn't typed one yet — don't overwrite their choice
      setLoteName((prev) => (prev.trim() ? prev : `INV-${autoNumber} · ${supplierName}`));

      if (detection.fileType === 'excel' && detection.parsedSheet) {
        // Check if we need manual mapping
        const { parsedSheet, columnMappings = {} } = detection;
        const sampleRows = parsedSheet.rawRows.slice(
          parsedSheet.headerRowIndex + 1,
          parsedSheet.headerRowIndex + 6
        ) as unknown[][];

        const rows: MappingRow[] = parsedSheet.headers
          .filter((h) => h.trim() !== '')
          .map((header) => {
            const sampleValues = sampleRows.map((r) => r[parsedSheet.headers.indexOf(header)]);
            const detectedField = (columnMappings[header] as StandardField) ||
              detectColumnType(header, sampleValues);
            const confidence = getConfidence(header, detectedField);
            const sample = sampleValues
              .filter((v) => v != null && v !== '')
              .slice(0, 2)
              .join(', ');
            return {
              header,
              sample: String(sample).substring(0, 60),
              detectedField,
              userField: detectedField,
              confidence,
            };
          });

        setMappingRows(rows);

        const hasUnmapped = rows.some((r) => r.detectedField === null);
        const savedTemplate = isNewSupplier
          ? undefined
          : suppliers.find((s) => s.id === supplierId)?.importTemplate;

        if (!hasUnmapped || savedTemplate) {
          // Auto-proceed to step 3
          const mappings: Record<string, string> = {};
          rows.forEach((r) => {
            if (r.userField) mappings[r.header] = r.userField;
          });
          setFinalMappings(mappings);
          const items = buildInvoiceItems(parsedSheet, mappings);
          setInvoiceItems(items);
          setStep(3);
        } else {
          setStep(2);
        }
      } else {
        // PDF — skip to step 3 with empty items
        setInvoiceItems([]);
        setStep(3);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      alert(msg);
    }
  };

  // ── Step 2 → advance ───────────────────────────────────────────────────────

  const handleStep2Next = () => {
    const hasIdentifier = mappingRows.some(
      (r) => r.userField === 'imei' || r.userField === 'fullModel' || r.userField === 'make'
    );
    if (!hasIdentifier) {
      alert('Mapea al menos el campo IMEI o Modelo Completo para continuar.');
      return;
    }

    const mappings: Record<string, string> = {};
    mappingRows.forEach((r) => {
      if (r.userField) mappings[r.header] = r.userField;
    });
    setFinalMappings(mappings);

    if (detection?.parsedSheet) {
      const items = buildInvoiceItems(detection.parsedSheet, mappings);
      setInvoiceItems(items);
    }
    setStep(3);
  };

  // ── Step 3 → pricing review ───────────────────────────────────────────────

  const handleImport = async () => {
    if (!file || !detection) return;

    try {
      const supplierId = await getOrCreateSupplierId();
      const supplierName = isNewSupplier
        ? newSupplierName.trim()
        : suppliers.find((s) => s.id === supplierId)?.name || '';

      let template: SupplierImportTemplate | undefined;
      if (saveTemplate && detection.fileType === 'excel' && Object.keys(finalMappings).length > 0) {
        template = {
          fileType: 'excel',
          hasIMEIs: detection.hasIMEIs,
          headerRow: detection.parsedSheet?.headerRowIndex ?? 0,
          columnMappings: buildTemplateColumnMappings(finalMappings),
          savedAt: new Date().toISOString(),
        };
      }

      // Save resolved supplier info so confirm step doesn't re-create the supplier
      pendingImportRef.current = { supplierId, supplierName, template };

      // Build price groups: one row per marca|modelo|storage combination
      const phoneItems = invoiceItems.filter((item) => item.type === 'phone');
      const groupMap = new Map<string, PriceGroup>();

      for (const item of phoneItems) {
        const key = `${item.resolvedMarca || item.make || ''}|${item.resolvedModelo || item.model || ''}|${item.storage || ''}`;
        const unitCost = item.unitPrice ?? costPerUnit;
        const existing = groupMap.get(key);
        if (existing) {
          existing.units += item.imei ? 1 : (item.qty || 1);
        } else {
          groupMap.set(key, {
            key,
            marca: item.resolvedMarca || item.make || 'Desconocida',
            modelo: item.resolvedModelo || item.model || item.fullModel || 'Desconocido',
            storage: item.storage || '',
            units: item.imei ? 1 : (item.qty || 1),
            unitCost,
            suggestedPrice: 0,
            source: 'auto',
            finalPrice: 0,
          });
        }
      }

      // Fetch price_catalog for each group to get historical prices
      setLoadingPrices(true);
      const groups = [...groupMap.values()];

      await Promise.all(
        groups.map(async (g) => {
          const displayBrand = normalizeDisplayBrand(g.marca);
          const storageVal = normalizeStorage(g.storage);
          const normalizedModel = displayBrand === 'Apple'
            ? normalizeIPhoneModel(g.modelo || '')
            : (g.modelo || 'Unknown');
          const safeId = `${displayBrand}-${normalizedModel}-${storageVal}`
            .replace(/\//g, '-')
            .replace(/\s+/g, '-')
            .toLowerCase();
          try {
            const snap = await getDoc(doc(db, 'price_catalog', safeId));
            if (snap.exists()) {
              const data = snap.data();
              const avg = Number(data.averagePrice) || 0;
              if (avg > 0) {
                g.suggestedPrice = avg;
                g.finalPrice = avg;
                g.source = 'catalog';
              }
            }
          } catch {
            // ignore — keep auto price
          }
        })
      );

      setLoadingPrices(false);
      setPriceGroups(groups);
      setStep('pricing');
    } catch (err) {
      setLoadingPrices(false);
      const msg = err instanceof Error ? err.message : 'Error al preparar precios';
      alert(msg);
    }
  };

  // ── Pricing → confirm & write to Firestore ────────────────────────────────

  const handleConfirmPricing = async () => {
    if (!file || !detection || !pendingImportRef.current) return;
    const { supplierId, supplierName, template } = pendingImportRef.current;

    try {
      const priceOverrides: Record<string, number> = {};
      priceGroups.forEach((g) => { priceOverrides[g.key] = g.finalPrice; });

      const phoneItems = invoiceItems.filter((item) => item.type === 'phone');
      const totalAmount = phoneItems.reduce((sum, item) => {
        const price = item.unitPrice ?? costPerUnit;
        return sum + price * (item.imei ? 1 : (item.qty || 1));
      }, 0);

      const invoiceId = await importInvoice.mutateAsync({
        supplierId,
        supplierName,
        invoiceNumber,
        fileName: file.name,
        fileType: detection.fileType,
        items: invoiceItems,
        loteName,
        costPerUnit,
        initialStatus,
        priceOverrides,
        totalAmount: totalAmount || undefined,
        importTemplate: template,
      });

      void invoiceId;
      setSuccessLote(loteName);
      setSuccessCount(phoneItems.length);
      setStep('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al importar';
      alert(msg);
    }
  };

  // ── Derived counts ─────────────────────────────────────────────────────────

  const phoneCount = invoiceItems.filter((i) => i.type === 'phone').length;
  const accessoryCount = invoiceItems.filter(
    (i) => i.type === 'accessory' || i.type === 'unknown'
  ).length;
  const invalidIMEICount = invoiceItems.filter(
    (i) => i.type === 'phone' && i.imei && !i.imeiValid
  ).length;

  const displayedRows = showAllRows ? invoiceItems : invoiceItems.slice(0, 20);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {(step === 2 || step === 3 || step === 'pricing') && (
              <button
                onClick={() => {
                  if (step === 'pricing') setStep(3);
                  else if (step === 3) setStep(detection?.fileType === 'excel' ? 2 : 1);
                  else setStep(1);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Importar Factura de Proveedor</h2>
              {step !== 'success' && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {step === 'pricing'
                    ? 'Revisión de precios — confirmá antes de importar'
                    : `Paso ${step} de 3${
                        step === 1
                          ? ' — Subir archivo y seleccionar proveedor'
                          : step === 2
                          ? ' — Mapear columnas'
                          : ' — Previsualizar e importar'
                      }`}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Step 1: Upload ────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-indigo-400 bg-indigo-50'
                    : file
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  className="hidden"
                  onChange={onFileInput}
                />
                {detecting ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                    <p className="text-sm text-gray-600">Analizando archivo...</p>
                  </div>
                ) : file && detection ? (
                  <div className="flex flex-col items-center gap-2">
                    {detection.fileType === 'excel' ? (
                      <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
                    ) : (
                      <FileText className="w-10 h-10 text-red-500" />
                    )}
                    <p className="font-semibold text-gray-800">{file.name}</p>
                    <div className="flex gap-3 flex-wrap justify-center">
                      <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-medium">
                        {detection.fileType === 'excel' ? 'Excel' : 'PDF'} detectado
                      </span>
                      {detection.rowCount > 0 && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
                          {detection.rowCount} filas
                        </span>
                      )}
                      {detection.hasIMEIs && (
                        <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full font-medium">
                          IMEIs encontrados: {detection.imeiCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Clic para cambiar archivo</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-10 h-10 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-700">
                        Arrastra o haz clic para subir
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        .xlsx, .xls, .csv, .pdf
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Supplier selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Proveedor</label>
                <select
                  value={isNewSupplier ? '__new__' : selectedSupplierId}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setIsNewSupplier(true);
                      setSelectedSupplierId('');
                    } else {
                      setIsNewSupplier(false);
                      setSelectedSupplierId(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                >
                  <option value="">Selecciona un proveedor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="__new__">+ Nuevo proveedor...</option>
                </select>

                {isNewSupplier && (
                  <input
                    type="text"
                    placeholder="Nombre del proveedor"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Column Mapping ────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Revisa el mapeo automático y corrige las columnas que no se detectaron.
              </p>

              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Columna detectada</th>
                      <th className="px-4 py-3 text-left font-medium">Muestra</th>
                      <th className="px-4 py-3 text-left font-medium">Mapear como</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {mappingRows.map((row, idx) => (
                      <tr key={row.header} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{row.header}</span>
                            {row.confidence === 'high' && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            )}
                            {row.confidence === 'medium' && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">~</span>
                            )}
                            {row.confidence === 'none' && (
                              <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                          {row.sample || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={row.userField || ''}
                            onChange={(e) => {
                              const newField = (e.target.value || null) as StandardField;
                              setMappingRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, userField: newField } : r
                                )
                              );
                            }}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                          >
                            <option value="">[Ignorar]</option>
                            {Object.entries(FIELD_LABELS).map(([val, label]) => (
                              <option key={val} value={val}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveTemplate}
                  onChange={(e) => setSaveTemplate(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600"
                />
                <span className="text-sm text-gray-700">
                  Guardar como plantilla para{' '}
                  <span className="font-medium">
                    {isNewSupplier
                      ? newSupplierName || 'este proveedor'
                      : suppliers.find((s) => s.id === selectedSupplierId)?.name || 'este proveedor'}
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* ── Step 3: Preview & Import ──────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{phoneCount}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Teléfonos</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-amber-700">{accessoryCount}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Accesorios/Partes</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-red-700">{invalidIMEICount}</p>
                  <p className="text-xs text-red-600 mt-0.5">IMEIs inválidos</p>
                </div>
              </div>

              {/* Preview table */}
              {invoiceItems.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Vista previa{' '}
                    <span className="text-gray-400">
                      ({Math.min(20, invoiceItems.length)} de {invoiceItems.length})
                    </span>
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">IMEI</th>
                          <th className="px-3 py-2 text-left">Marca</th>
                          <th className="px-3 py-2 text-left">Modelo</th>
                          <th className="px-3 py-2 text-left">Storage</th>
                          <th className="px-3 py-2 text-left">Carrier</th>
                          <th className="px-3 py-2 text-right">Precio</th>
                          <th className="px-3 py-2 text-left">Tipo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {displayedRows.map((item) => {
                          let rowClass = 'bg-white';
                          if (item.type === 'phone' && item.imei && item.imeiValid) {
                            rowClass = 'border-l-2 border-emerald-400';
                          } else if (item.type === 'phone' && !item.imei) {
                            rowClass = 'border-l-2 border-yellow-400 bg-yellow-50/30';
                          } else if (item.type === 'accessory' || item.type === 'unknown') {
                            rowClass = 'border-l-2 border-orange-300 bg-orange-50/30';
                          } else if (item.imei && !item.imeiValid) {
                            rowClass = 'border-l-2 border-red-400 bg-red-50/30';
                          }

                          return (
                            <tr key={item.rowIndex} className={rowClass}>
                              <td className="px-3 py-2 text-gray-400">{item.rowIndex + 1}</td>
                              <td className="px-3 py-2 font-mono">
                                {item.imei ? (
                                  <span className={item.imeiValid ? 'text-gray-700' : 'text-red-500'}>
                                    {item.imei}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-700">
                                {item.resolvedMarca || item.make || '—'}
                              </td>
                              <td className="px-3 py-2 text-gray-700 max-w-[120px] truncate">
                                {item.resolvedModelo || item.model || item.fullModel || '—'}
                              </td>
                              <td className="px-3 py-2 text-gray-500">{item.storage || '—'}</td>
                              <td className="px-3 py-2 text-gray-500">{item.carrier || '—'}</td>
                              <td className="px-3 py-2 text-right text-gray-700">
                                {item.unitPrice ? `$${item.unitPrice}` : '—'}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    item.type === 'phone'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : item.type === 'accessory' || item.type === 'unknown'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {item.type === 'phone'
                                    ? 'Teléfono'
                                    : item.type === 'accessory'
                                    ? 'Accesorio'
                                    : item.type === 'part'
                                    ? 'Parte'
                                    : 'Desc.'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {invoiceItems.length > 20 && (
                    <button
                      onClick={() => setShowAllRows((v) => !v)}
                      className="mt-2 text-xs text-indigo-600 hover:underline"
                    >
                      {showAllRows ? 'Ver menos' : `Ver todas las ${invoiceItems.length} filas`}
                    </button>
                  )}
                </div>
              )}

              {/* Configuration */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">Configuración de importación</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Número de factura
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Nombre del lote
                    </label>
                    <input
                      type="text"
                      value={loteName}
                      onChange={(e) => setLoteName(e.target.value)}
                      list="existing-batches-import"
                      placeholder="Escribe o elegi un lote existente"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 outline-none bg-white"
                    />
                    <datalist id="existing-batches-import">
                      {existingBatches.map((b) => (
                        <option key={b.id} value={b.name} />
                      ))}
                    </datalist>
                    <p className="text-xs text-gray-400 mt-1">
                      Para AGREGAR a un lote existente, seleccionalo de la lista. Cuidado con espacios y mayusculas.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Precio de costo por defecto (USD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={costPerUnit || ''}
                      onChange={(e) => setCostPerUnit(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 outline-none bg-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Se usa cuando el archivo no incluye precio por unidad
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Estado inicial
                    </label>
                    <select
                      value={initialStatus}
                      onChange={(e) => setInitialStatus(e.target.value as PhoneStatus)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 outline-none bg-white"
                    >
                      {INITIAL_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {costPerUnit > 0 && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-700">
                    En el siguiente paso podrás revisar y escribir el precio de venta de cada modelo.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step: Pricing Review ──────────────────────────────────── */}
          {step === 'pricing' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900">Revisá los precios antes de importar</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {priceGroups.reduce((s, g) => s + g.units, 0)} teléfonos ·{' '}
                  {priceGroups.length} modelo{priceGroups.length !== 1 ? 's' : ''} distinto{priceGroups.length !== 1 ? 's' : ''}.
                  Escribí el precio de venta de cada modelo.
                </p>
                {priceGroups.some(g => g.finalPrice <= 0) && (
                  <div className="mt-2 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-medium">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Hay modelos sin precio. Completá todos antes de importar.
                  </div>
                )}
              </div>

              {loadingPrices ? (
                <div className="flex items-center justify-center py-10 gap-3 text-indigo-600">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-sm">Consultando historial de precios...</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Modelo</th>
                        <th className="px-4 py-3 text-center">Uds</th>
                        <th className="px-4 py-3 text-right">Costo unit.</th>
                        <th className="px-4 py-3 text-right">Precio de venta</th>
                        <th className="px-4 py-3 text-center">Fuente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {priceGroups.map((g, i) => (
                        <tr key={g.key} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{g.modelo}</p>
                            {(g.storage || g.marca) && (
                              <p className="text-xs text-gray-400">
                                {g.marca}{g.storage ? ` · ${g.storage}` : ''}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-700">{g.units}</td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            {g.unitCost > 0 ? `$${g.unitCost.toFixed(0)}` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-gray-400">$</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={g.finalPrice}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setPriceGroups((prev) =>
                                    prev.map((p, j) => (j === i ? { ...p, finalPrice: val } : p))
                                  );
                                }}
                                className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-right font-bold focus:ring-2 focus:ring-indigo-300 outline-none text-sm"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {g.source === 'catalog' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                                ✓ Historial
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
                                Ingresá precio
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-600">
                          Ingresos esperados
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-700 text-sm">
                          ${priceGroups.reduce((s, g) => s + g.finalPrice * g.units, 0).toLocaleString()}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Success screen ─────────────────────────────────────────── */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 gap-5">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-emerald-500" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  {successCount} teléfonos importados
                </h3>
                <p className="text-gray-500 mt-1">
                  Lote <span className="font-medium text-gray-700">{successLote}</span> creado
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  navigate('/inventory');
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                Ver en Inventario
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step !== 'success' && (
          <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancelar
            </button>

            {step === 1 && (
              <button
                onClick={handleStep1Next}
                disabled={
                  !file ||
                  !detection ||
                  detecting ||
                  createSupplier.isPending ||
                  (!isNewSupplier && !selectedSupplierId) ||
                  (isNewSupplier && !newSupplierName.trim())
                }
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {createSupplier.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Continuar
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}

            {step === 2 && (
              <button
                onClick={handleStep2Next}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleImport}
                disabled={
                  loadingPrices ||
                  !invoiceNumber.trim() ||
                  !loteName.trim() ||
                  phoneCount === 0
                }
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loadingPrices ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cargando precios...
                  </>
                ) : (
                  <>
                    Revisar precios
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}

            {step === 'pricing' && (
              <button
                onClick={handleConfirmPricing}
                disabled={importInvoice.isPending || priceGroups.length === 0 || priceGroups.some(g => g.finalPrice <= 0)}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {importInvoice.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    Confirmar e Importar {priceGroups.reduce((s, g) => s + g.units, 0)} teléfonos
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Internal helper ───────────────────────────────────────────────────────────

function buildTemplateColumnMappings(
  finalMappings: Record<string, string>
): SupplierImportTemplate['columnMappings'] {
  const result: SupplierImportTemplate['columnMappings'] = {};
  for (const [header, field] of Object.entries(finalMappings)) {
    if (field === 'imei') result.imei = header;
    else if (field === 'make') result.make = header;
    else if (field === 'model') result.model = header;
    else if (field === 'storage') result.storage = header;
    else if (field === 'carrier') result.carrier = header;
    else if (field === 'fullModel') result.fullModel = header;
    else if (field === 'unitPrice') result.unitPrice = header;
    else if (field === 'qty') result.qty = header;
    else if (field === 'boxNumber') result.boxNumber = header;
  }
  return result;
}
