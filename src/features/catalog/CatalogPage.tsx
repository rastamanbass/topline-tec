import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { CatalogItem } from '../../types';
import { Loader2, Search, Tag, Edit2, Trash2, Save, X, HardDrive } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [fileteredItems, setFilteredItems] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editStorage, setEditStorage] = useState<string>('');

  useEffect(() => {
    fetchCatalog();
  }, []);

  useEffect(() => {
    if (!search) {
      setFilteredItems(items);
    } else {
      const q = search.toLowerCase();
      setFilteredItems(
        items.filter((i) => i.model.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q))
      );
    }
  }, [search, items]);

  // Sync Logic
  const handleSync = async () => {
    if (!confirm('¿Analizar el inventario actual para aprender precios?')) return;
    setIsLoading(true);
    let learned = 0;
    try {
      const phonesSnap = await getDocs(collection(db, 'phones'));
      const batchUpdates = [];

      for (const phoneDoc of phonesSnap.docs) {
        const phone = phoneDoc.data();
        if (phone.precioVenta > 0 && phone.modelo) {
          const storageVal = phone.storage || 'Unknown';
          const safeId = `${phone.marca}-${phone.modelo}-${storageVal}`
            .replace(/\//g, '-')
            .replace(/\s+/g, '-')
            .toLowerCase();

          // We overwrite with the latest known price from stock
          // Ideally we'd average, but last-seen is good enough for now.
          const catalogRef = doc(db, 'price_catalog', safeId);
          batchUpdates.push(
            setDoc(
              catalogRef,
              {
                brand: phone.marca,
                model: phone.modelo,
                storage: storageVal,
                averagePrice: phone.precioVenta,
                lastUpdated: new Date(),
                source: 'auto',
              },
              { merge: true }
            )
          );
          learned++;
        }
      }
      await Promise.all(batchUpdates);
      toast.success(`¡Aprendí ${learned} precios del inventario!`);
      fetchCatalog(); // Refresh view
    } catch (e) {
      console.error(e);
      toast.error('Error al sincronizar');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      setIsLoading(true);
      const snap = await getDocs(collection(db, 'price_catalog'));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CatalogItem);
      // Sort: Apple first, then Samsung
      data.sort((a, b) => {
        if (a.brand === b.brand) return a.model.localeCompare(b.model);
        return a.brand.localeCompare(b.brand);
      });
      setItems(data);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar catálogo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este precio guardado?')) return;
    try {
      await deleteDoc(doc(db, 'price_catalog', id));
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success('Eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setEditPrice(item.averagePrice);
    setEditStorage(item.storage);
  };

  const saveEdit = async (id: string) => {
    try {
      const item = items.find((i) => i.id === id);
      if (!item) return;

      const needsMigration = item.storage !== editStorage;

      if (needsMigration) {
        // Calculate new ID
        const storageVal = editStorage || 'Unknown';
        const newId = `${item.brand}-${item.model}-${storageVal}`
          .replace(/\//g, '-')
          .replace(/\s+/g, '-')
          .toLowerCase();

        // Create new doc
        await setDoc(doc(db, 'price_catalog', newId), {
          ...item,
          storage: storageVal,
          averagePrice: Number(editPrice),
          lastUpdated: new Date(),
          source: 'manual_edit',
        });

        // Delete old doc
        await deleteDoc(doc(db, 'price_catalog', id));

        // Update local state (tricky due to ID change)
        setItems((prev) =>
          prev.map((i) =>
            i.id === id
              ? { ...i, id: newId, storage: storageVal, averagePrice: Number(editPrice) }
              : i
          )
        );
      } else {
        // Just update price
        await updateDoc(doc(db, 'price_catalog', id), {
          averagePrice: Number(editPrice),
          lastUpdated: new Date(),
        });
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, averagePrice: Number(editPrice) } : i))
        );
      }

      setEditingId(null);
      toast.success('Actualizado');
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl border shadow-sm gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Catálogo de Precios</h1>
              <p className="text-gray-500">Base de conocimiento de modelos y precios</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSync}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
              title="Aprender precios del inventario existente"
            >
              <HardDrive className="w-4 h-4" />
              <span className="hidden sm:inline">Sincronizar Cerebro</span>
            </button>
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar modelo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No hay precios guardados aún.
            <br />
            <span className="text-sm">
              Agrega teléfonos al inventario para poblar esta lista automáticamente.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-6 py-4 font-medium text-gray-500">Marca</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Modelo</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Capacidad</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Precio Sugerido</th>
                  <th className="px-6 py-4 text-right font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fileteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 space-x-2">
                      {item.brand === 'Apple' ? '🍎' : item.brand === 'Samsung' ? '🤖' : '📱'}
                      <span className="font-medium text-gray-900">{item.brand}</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">{item.model}</td>
                    <td className="px-6 py-4">
                      {editingId === item.id ? (
                        <input
                          type="text"
                          className="w-24 border rounded px-2 py-1"
                          value={editStorage}
                          onChange={(e) => setEditStorage(e.target.value)}
                          placeholder="128GB"
                        />
                      ) : (
                        <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-600 font-mono text-xs">
                          {item.storage}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === item.id ? (
                        <input
                          type="number"
                          className="w-32 border rounded px-2 py-1"
                          value={editPrice}
                          onChange={(e) => setEditPrice(Number(e.target.value))}
                          autoFocus
                        />
                      ) : (
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                          ${item.averagePrice.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {editingId === item.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(item.id)}
                              className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(item)}
                              className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
