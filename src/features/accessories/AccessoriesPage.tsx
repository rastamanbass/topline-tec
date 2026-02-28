import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package, Plus, Search, Edit2, Trash2, AlertTriangle, X } from 'lucide-react';
import {
  useAccessories,
  useCreateAccessory,
  useUpdateAccessory,
  useDeleteAccessory,
  CATEGORIES,
  type Accessory,
} from './hooks/useAccessories';
import AccessoryForm from './components/AccessoryForm';
import { useAuth } from '../../context';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

export default function AccessoriesPage() {
  const { userRole } = useAuth();
  const { data: accessories = [], isLoading } = useAccessories();
  const createMut = useCreateAccessory();
  const updateMut = useUpdateAccessory();
  const deleteMut = useDeleteAccessory();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Accessory | null>(null);

  const canWrite = ['admin', 'gerente'].includes(userRole || '');

  const filtered = useMemo(() => {
    let list = accessories.filter((a) => a.isActive || canWrite);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.brand || '').toLowerCase().includes(q) ||
          (a.sku || '').toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      list = list.filter((a) => a.category === categoryFilter);
    }
    return list;
  }, [accessories, search, categoryFilter, canWrite]);

  const lowStockCount = accessories.filter((a) => a.stock <= a.minStock && a.isActive).length;

  const handleCreate = async (data: Omit<Accessory, 'id' | 'updatedAt'>) => {
    await createMut.mutateAsync(data);
    setShowForm(false);
  };

  const handleUpdate = async (data: Omit<Accessory, 'id' | 'updatedAt'>) => {
    if (!editTarget) return;
    await updateMut.mutateAsync({ id: editTarget.id, data });
    setEditTarget(null);
  };

  const handleDelete = (acc: Accessory) => {
    if (confirm(`¿Eliminar "${acc.name}"? Esta acción no se puede deshacer.`)) {
      deleteMut.mutate(acc.id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-purple-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Accesorios</h1>
                <p className="text-xs text-gray-500">{filtered.length} productos</p>
              </div>
              {lowStockCount > 0 && (
                <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  {lowStockCount} bajo stock
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-3">
              {/* Search */}
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar accesorio..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {canWrite && (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Agregar
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Category Filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setCategoryFilter('')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              !categoryFilter
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            Todos
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                categoryFilter === cat
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>
              {search || categoryFilter
                ? 'No hay accesorios con ese filtro'
                : 'No hay accesorios registrados'}
            </p>
            {canWrite && !search && !categoryFilter && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 text-purple-600 font-medium text-sm hover:underline"
              >
                Agregar el primero
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-medium border-b border-gray-100">
                  <th className="text-left px-4 py-3">Producto</th>
                  <th className="text-left px-4 py-3">Categoría</th>
                  <th className="text-right px-4 py-3">Costo</th>
                  <th className="text-right px-4 py-3">Precio</th>
                  <th className="text-right px-4 py-3">Margen</th>
                  <th className="text-center px-4 py-3">Stock</th>
                  {canWrite && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((acc) => {
                  const margin =
                    acc.salePrice > 0 ? ((acc.salePrice - acc.costPrice) / acc.salePrice) * 100 : 0;
                  const isLowStock = acc.stock <= acc.minStock;

                  return (
                    <tr
                      key={acc.id}
                      className={`hover:bg-gray-50 ${!acc.isActive ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{acc.name}</p>
                        {acc.brand && <p className="text-xs text-gray-400">{acc.brand}</p>}
                        {acc.sku && <p className="text-xs text-gray-300 font-mono">{acc.sku}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                          {acc.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(acc.costPrice)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {fmt(acc.salePrice)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            margin >= 30
                              ? 'bg-emerald-100 text-emerald-700'
                              : margin >= 15
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {margin.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-sm font-bold ${
                            isLowStock ? 'text-orange-600' : 'text-gray-900'
                          }`}
                        >
                          {acc.stock}
                          {isLowStock && (
                            <AlertTriangle className="inline w-3 h-3 ml-1 text-orange-500" />
                          )}
                        </span>
                        <p className="text-xs text-gray-400">min: {acc.minStock}</p>
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => setEditTarget(acc)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(acc)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modals */}
      {showForm && (
        <AccessoryForm
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
          isLoading={createMut.isPending}
        />
      )}
      {editTarget && (
        <AccessoryForm
          initialData={editTarget}
          onSubmit={handleUpdate}
          onClose={() => setEditTarget(null)}
          isLoading={updateMut.isPending}
        />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-14 bg-gray-200 rounded-lg" />
      ))}
    </div>
  );
}
