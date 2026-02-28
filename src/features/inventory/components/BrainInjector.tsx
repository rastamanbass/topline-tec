import { useState } from 'react';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Brain, Database, Check } from 'lucide-react';
import toast from 'react-hot-toast';

// Data from MIT Analyzer
import learnedPrices from '../../../data/learned_prices.json';
import learnedTac from '../../../data/learned_tac.json';

export const BrainInjector = () => {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [progress, setProgress] = useState(0);

  const handleInject = async () => {
    if (!confirm('CONFIRM INJECTION: This will overwrite 1000+ records in the Brain.')) return;

    try {
      setStatus('uploading');
      const total = learnedPrices.length + learnedTac.length;
      let current = 0;

      // 1. Upload Prices (Batch of 400)
      const priceChunks = chunkArray(learnedPrices, 400);
      for (const chunk of priceChunks) {
        const batch = writeBatch(db);
        chunk.forEach((p) => {
          const ref = doc(db, 'price_catalog', p.id);
          batch.set(
            ref,
            {
              ...p,
              lastUpdated: new Date(),
              source: 'mit_v3_universe',
            },
            { merge: true }
          );
        });
        await batch.commit();
        current += chunk.length;
        setProgress(Math.round((current / total) * 100));
      }

      // 2. Upload TACs (Batch of 400)
      const tacChunks = chunkArray(learnedTac, 400);
      for (const chunk of tacChunks) {
        const batch = writeBatch(db);
        chunk.forEach((t) => {
          const ref = doc(db, 'device_definitions', t.tac);
          batch.set(
            ref,
            {
              brand: t.brand,
              model: t.model,
              confidence: t.confidence,
              lastUpdated: new Date(),
            },
            { merge: true }
          );
        });
        await batch.commit();
        current += chunk.length;
        setProgress(Math.round((current / total) * 100));
      }

      setStatus('done');
      toast.success('🧠 Brain Upgrade Complete!');

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (e) {
      console.error(e);
      toast.error('Injection Failed');
      setStatus('idle');
    }
  };

  const handlePurge = async () => {
    if (
      !confirm(
        '⚠️ DANGER: This will delete ALL "Unknown" entries from the Price Catalog. Are you sure?'
      )
    )
      return;

    try {
      setStatus('uploading');
      toast.loading('Scanning for ghosts...');

      // We have to client-side filter because we can't easily query "OR" on multiple fields without index
      const { getDocs, collection } = await import('firebase/firestore');
      const snap = await getDocs(collection(db, 'price_catalog'));

      const ghosts = snap.docs.filter((d) => {
        const data = d.data();
        return data.brand === 'Unknown' || data.model === 'Unknown' || d.id.includes('unknown');
      });

      if (ghosts.length === 0) {
        toast.dismiss();
        toast.success('No ghosts found!');
        setStatus('idle');
        return;
      }

      if (!confirm(`Found ${ghosts.length} ghost records. Delete them?`)) {
        setStatus('idle');
        return;
      }

      // Batch delete
      const chunks = chunkArray(ghosts, 400);
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((g) => batch.delete(g.ref));
        await batch.commit();
      }

      toast.dismiss();
      toast.success(`🧹 Deleted ${ghosts.length} ghosts!`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      console.error(e);
      toast.error('Purge Failed');
      setStatus('idle');
    }
  };

  function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg">
        <Check className="w-5 h-5" />
        <span className="font-bold">Action Complete</span>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleInject}
        disabled={status === 'uploading'}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-75"
      >
        {status === 'uploading' ? (
          <>
            <Database className="w-5 h-5 animate-pulse" />
            <span>Processing... {progress}%</span>
          </>
        ) : (
          <>
            <Brain className="w-5 h-5" />
            <span className="font-bold">INJECT</span>
          </>
        )}
      </button>
      <button
        onClick={handlePurge}
        disabled={status === 'uploading'}
        className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        title="Eliminar registros desconocidos (Fantasmas)"
      >
        🗑️ Purge Ghosts
      </button>
    </div>
  );
};
