/**
 * useSupplierInvoices — React Query hooks for the `supplierInvoices` Firestore collection.
 * Handles the main import mutation that creates phones, records the invoice, and updates supplier stats.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  increment,
  serverTimestamp,
  orderBy,
  query,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import type {
  SupplierInvoice,
  SupplierInvoiceItem,
  PhoneStatus,
  SupplierImportTemplate,
} from '../../../types';
import toast from 'react-hot-toast';
import { SUPPLIERS_QUERY_KEY } from './useSuppliers';
import { splitMarcaAndSupplier } from '../../../lib/phoneUtils';

// ── Query key ─────────────────────────────────────────────────────────────────

export const SUPPLIER_INVOICES_QUERY_KEY = ['supplierInvoices'] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapInvoice(d: { id: string; data: () => Record<string, unknown> }): SupplierInvoice {
  const data = d.data();
  return {
    id: d.id,
    supplierId: String(data.supplierId || ''),
    supplierName: String(data.supplierName || ''),
    invoiceNumber: String(data.invoiceNumber || ''),
    invoiceDate: data.invoiceDate as string | undefined,
    fileName: String(data.fileName || ''),
    fileType: (data.fileType as 'excel' | 'pdf') || 'excel',
    totalRows: Number(data.totalRows ?? 0),
    totalPhones: Number(data.totalPhones ?? 0),
    totalAccessories: Number(data.totalAccessories ?? 0),
    totalParts: Number(data.totalParts ?? 0),
    totalAmount: data.totalAmount != null ? Number(data.totalAmount) : undefined,
    importedPhoneIds: (data.importedPhoneIds as string[]) || [],
    importedLote: String(data.importedLote || ''),
    initialStatus: data.initialStatus as PhoneStatus,
    status: (data.status as SupplierInvoice['status']) || 'imported',
    importedByEmail: String(data.importedByEmail || ''),
    importedByName: data.importedByName as string | null | undefined,
    createdAt: data.createdAt,
  };
}

// ── useSupplierInvoices ───────────────────────────────────────────────────────

/**
 * List all supplier invoices, ordered by createdAt descending.
 */
export function useSupplierInvoices() {
  return useQuery({
    queryKey: SUPPLIER_INVOICES_QUERY_KEY,
    queryFn: async (): Promise<SupplierInvoice[]> => {
      const q = query(
        collection(db, 'supplierInvoices'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(mapInvoice);
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// ── Import mutation types ─────────────────────────────────────────────────────

export interface ImportInvoiceInput {
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate?: string;
  fileName: string;
  fileType: 'excel' | 'pdf';

  items: SupplierInvoiceItem[];

  loteName: string;
  costPerUnit: number; // applied when item.unitPrice is absent
  initialStatus: PhoneStatus;
  priceOverrides?: Record<string, number>; // key: "marca|modelo|storage" → price per model

  totalAmount?: number;

  /** If provided, saves/updates the import template on the supplier doc */
  importTemplate?: SupplierImportTemplate;
}

const BATCH_SIZE = 490; // Firestore max is 500 ops per batch; keep safety margin

// ── useImportSupplierInvoice ──────────────────────────────────────────────────

/**
 * Main import mutation:
 * 1. Batch-creates phones in Firestore
 * 2. Creates the supplierInvoices/{id} document
 * 3. Updates supplier's invoiceCount and totalPhonesPurchased
 * 4. Saves/updates import template if provided
 *
 * Returns the created invoice ID.
 */
export function useImportSupplierInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ImportInvoiceInput): Promise<string> => {
      const {
        supplierId,
        supplierName,
        invoiceNumber,
        invoiceDate,
        fileName,
        fileType,
        items,
        loteName,
        costPerUnit,
        initialStatus,
        priceOverrides,
        totalAmount,
        importTemplate,
      } = input;

      const currentUser = auth.currentUser;
      const importerEmail = currentUser?.email || 'import';
      const importerName = currentUser?.displayName || null;

      // Filter to only phone-type items (accessories/parts are skipped from phone creation)
      const phoneItems = items.filter((item) => item.type === 'phone');
      const accessoryItems = items.filter((item) => item.type === 'accessory');
      const partItems = items.filter((item) => item.type === 'part');

      // ── Batch-create phones ────────────────────────────────────────────────
      const importedPhoneIds: string[] = [];
      const phonesToCreate: Record<string, unknown>[] = [];

      phoneItems.forEach((item, i) => {
        const qty = item.qty || 1;
        const unitCost = item.unitPrice ?? costPerUnit;
        const priceKey = `${item.resolvedMarca || item.make || ''}|${item.resolvedModelo || item.model || ''}|${item.storage || ''}`;
        const precioVenta = priceOverrides?.[priceKey] ?? 0;
        const imei = item.imei || `PENDING-${Date.now()}-${i}`;

        // For items with IMEIs (Format A), create one doc per phone
        // For items without IMEIs (Format B), create qty docs with placeholder IMEIs
        const count = item.imei ? 1 : qty;

        const rawMarca = item.resolvedMarca || item.make || 'Desconocida';
        const rawModelo = item.resolvedModelo || item.model || item.fullModel || 'Desconocido';
        const { marca: finalMarca, supplierCode } = splitMarcaAndSupplier(rawMarca, rawModelo);

        for (let j = 0; j < count; j++) {
          const phoneImei = item.imei
            ? imei
            : `PENDING-${Date.now()}-${i}-${j}`;

          phonesToCreate.push({
            imei: phoneImei,
            marca: finalMarca,
            supplierCode: supplierCode,
            modelo: rawModelo,
            storage: item.storage || '',
            lote: loteName,
            costo: unitCost,
            precioVenta,
            estado: initialStatus,
            condition: 'Grade A',
            fechaIngreso: new Date().toISOString(),
            createdBy: currentUser?.uid || '',
            statusHistory: [
              {
                newStatus: initialStatus,
                date: new Date().toISOString(),
                user: importerEmail,
                details: `Importado desde factura ${invoiceNumber} · ${supplierName}`,
              },
            ],
          });
        }
      });

      // Execute batch writes (max BATCH_SIZE per batch)
      for (let start = 0; start < phonesToCreate.length; start += BATCH_SIZE) {
        const chunk = phonesToCreate.slice(start, start + BATCH_SIZE);
        const batch = writeBatch(db);
        const phonesRef = collection(db, 'phones');

        chunk.forEach((phoneData) => {
          const newRef = doc(phonesRef);
          batch.set(newRef, phoneData);
          importedPhoneIds.push(newRef.id);
        });

        await batch.commit();
      }

      // ── Create supplier invoice document ───────────────────────────────────
      const invoiceData = {
        supplierId,
        supplierName,
        invoiceNumber,
        invoiceDate: invoiceDate || null,
        fileName,
        fileType,
        totalRows: items.length,
        totalPhones: phoneItems.length,
        totalAccessories: accessoryItems.length,
        totalParts: partItems.length,
        totalAmount: totalAmount ?? null,
        importedPhoneIds,
        importedLote: loteName,
        initialStatus,
        status: 'imported',
        importedByEmail: importerEmail,
        importedByName: importerName,
        createdAt: serverTimestamp(),
      };

      const invoiceRef = await addDoc(collection(db, 'supplierInvoices'), invoiceData);

      // ── Update supplier stats ──────────────────────────────────────────────
      const supplierRef = doc(db, 'suppliers', supplierId);
      await updateDoc(supplierRef, {
        invoiceCount: increment(1),
        totalPhonesPurchased: increment(importedPhoneIds.length),
        updatedAt: serverTimestamp(),
        ...(importTemplate ? { importTemplate } : {}),
      });

      return invoiceRef.id;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUPPLIER_INVOICES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      queryClient.invalidateQueries({ queryKey: ['phones-paginated'] });
      toast.success('Factura importada correctamente');
    },

    onError: (err) => {
      console.error('useImportSupplierInvoice error:', err);
      toast.error('Error al importar factura');
    },
  });
}
