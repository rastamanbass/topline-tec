import { useState } from 'react';
import { collection, writeBatch, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import seedDataRaw from '../../../data/inventory_seed_v2.json';
import { Loader2, HardDrive } from 'lucide-react';
import toast from 'react-hot-toast';

export const SeederButton = () => {
  const [isLoading, setIsLoading] = useState(false);

  // Cast json to explicit type if needed, or trust auto-inference
  const seedData = seedDataRaw as Record<string, unknown>[];

  const handleSeed = async () => {
    if (
      !confirm(
        'Esto importará ' +
          seedData.length +
          ' teléfonos (Optimizado). Los duplicados se omitirán. ¿Continuar?'
      )
    )
      return;

    setIsLoading(true);
    let addedCount = 0;
    let skippedCount = 0;

    try {
      // 1. Get ALL existing IMEIs in one go (Memory efficient for <10k items)
      const existingSnaps = await getDocs(collection(db, 'phones'));
      const existingImeis = new Set(existingSnaps.docs.map((d) => d.data().imei));

      // 2. Prepare Batch
      const batch = writeBatch(db);
      const phonesCollection = collection(db, 'phones');

      seedData.forEach((item: Record<string, unknown>) => {
        if (existingImeis.has(item.imei)) {
          skippedCount++;
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...data } = item;
        // Create a new ref
        const newDocRef = doc(phonesCollection);

        batch.set(newDocRef, {
          ...data,
          fechaIngreso: serverTimestamp(),
          createdBy: auth.currentUser?.uid || 'system_seed_v2',
          updatedAt: serverTimestamp(),
          lote: 'LEGACY_IMPORT_V2',
          statusHistory: [
            {
              newStatus: item.estado,
              date: new Date(),
              user: 'system_import',
              details: item.details || 'Importación masiva V2 (Optimizado)',
            },
          ],
        });
        addedCount++;
      });

      // 3. Commit Batch (Atomic)
      if (addedCount > 0) {
        await batch.commit();
        toast.success(`Éxito: ${addedCount} agregados, ${skippedCount} omitidos.`);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast('Todo está actualizado. No hay nada nuevo.', { icon: '✅' });
      }
    } catch (error) {
      console.error('Critical Import Error:', error);
      toast.error('Error crítico al importar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleSeed}
      disabled={isLoading}
      className="flex items-center gap-2 px-3 py-1.5 ml-2 text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md hover:bg-yellow-100 disabled:opacity-50 transition-colors"
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <HardDrive className="mr-2 h-4 w-4" />
      )}
      Importar Legado ({seedData.length})
    </button>
  );
};
