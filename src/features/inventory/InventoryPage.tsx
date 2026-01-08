import { Package, Plus } from 'lucide-react';
import SearchBar from './components/SearchBar';
import Filters from './components/Filters';
import PhoneTable from './components/PhoneTable';
import { useInventoryStore } from './stores/inventoryStore';
import { useAuth } from '../../context';

export default function InventoryPage() {
  const { openModal } = useInventoryStore();
  const { userRole } = useAuth();

  const canCreate = ['admin', 'gerente'].includes(userRole || '');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
                <p className="text-sm text-gray-600">Gestión de Teléfonos</p>
              </div>
            </div>

            {canCreate && (
              <button
                onClick={() => openModal('create')}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nuevo Teléfono
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <SearchBar />
          <Filters />
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <PhoneTable />
        </div>
      </main>
    </div>
  );
}
