import { useState } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Wrench, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const DataRepairButton = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleRepair = async () => {
    if (!confirm('¿Escanear y reparar marcas "Unknown" en el inventario?')) return;
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'phones'));
      const batch = writeBatch(db);
      let count = 0;

      snap.docs.forEach((d) => {
        const data = d.data();
        const currentBrand = data.marca || 'Unknown';
        const model = (data.modelo || '').toUpperCase();
        let newBrand = currentBrand;

        // Fix Unknowns or Mis-cased
        if (currentBrand === 'Unknown' || currentBrand === 'HEC') {
          if (
            model.includes('IPHONE') ||
            model.includes('11') ||
            model.includes('12') ||
            model.includes('13') ||
            model.includes('14') ||
            model.includes('15') ||
            model.includes('16') ||
            model.includes('17')
          ) {
            newBrand = 'Apple';
          } else if (
            model.includes('GALAXY') ||
            model.includes('S22') ||
            model.includes('S23') ||
            model.includes('S24') ||
            model.includes('NOTE')
          ) {
            newBrand = 'Samsung';
          }
        }

        if (newBrand !== currentBrand) {
          batch.update(doc(db, 'phones', d.id), { marca: newBrand });
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        toast.success(`Reparados ${count} teléfonos mal clasificados.`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.success('El inventario ya está limpio.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al reparar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleRepair}
      disabled={isLoading}
      className="flex items-center gap-2 px-3 py-1.5 ml-2 text-orange-700 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100 disabled:opacity-50 transition-colors"
      title="Reparar Marcas Desconocidas"
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
      <span className="hidden sm:inline">Reparar Datos</span>
    </button>
  );
};
