import { useState } from 'react';
import { useBatches } from '../hooks/useBatches';
import { Plus, Trash2, X, Package } from 'lucide-react';

export default function BatchManager({ onClose }: { onClose: () => void }) {
  const { batches, addBatch, removeBatch } = useBatches();
  const [newBatchName, setNewBatchName] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) return;

    await addBatch.mutateAsync(newBatchName);
    setNewBatchName('');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-30 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-gray-900 mb-4">Administrar Lotes</h3>

        {/* Add New Batch */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            type="text"
            className="flex-1 input-field"
            placeholder="Nuevo lote (ej. LOTE-2024-02)"
            value={newBatchName}
            onChange={(e) => setNewBatchName(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className="btn-primary flex items-center justify-center w-12"
            disabled={addBatch.isPending || !newBatchName.trim()}
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        {/* List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {batches.length === 0 && (
            <p className="text-center text-gray-500 py-4 text-sm">No hay lotes creados.</p>
          )}
          {batches.map((batch) => {
            const isFromPhones = batch.id.startsWith('phone-lote-');
            return (
              <div
                key={batch.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isFromPhones && <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <span className="font-medium text-gray-700 truncate">{batch.name}</span>
                </div>
                {!isFromPhones && (
                  <button
                    onClick={() => removeBatch.mutate(batch.id)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    title="Eliminar Lote"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
