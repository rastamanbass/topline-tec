import { Package, Plus, LayoutGrid, List, Loader2, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import ImportInvoiceModal from '../supplier-invoices/components/ImportInvoiceModal';
import SearchBar from './components/SearchBar';
import Filters from './components/Filters';
import PhoneTable from './components/PhoneTable';
import CatalogView from './components/CatalogView';
import PhoneModal from './components/PhoneModal';
import PhoneDetailsModal from './components/PhoneDetailsModal';
import BulkActions from './components/BulkActions';
import PaymentModal from '../sales/components/PaymentModal';

import { useInventoryStore } from './stores/inventoryStore';
import { usePhonesPaginated } from './hooks/usePhones';
import { useAuth } from '../../context';

export default function InventoryPage() {
  const [showImportModal, setShowImportModal] = useState(false);
  const {
    openModal,
    searchQuery,
    selectedLot,
    selectedStatus,
    viewMode,
    setViewMode,
  } = useInventoryStore();
  const { userRole } = useAuth();

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePhonesPaginated({
    lot: selectedLot,
    status: selectedStatus,
    searchQuery,
  });

  // Flatten all pages into a single array
  const phones = data?.pages.flatMap((page) => page.phones) ?? [];
  const totalLoaded = phones.length;

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
                <p className="text-sm text-gray-600">
                  Gestión de Teléfonos
                  {!isLoading && totalLoaded > 0 && (
                    <span className="ml-2 text-primary-600 font-medium">
                      · {totalLoaded} cargados
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                  title="Vista de Lista"
                  aria-label="Vista de lista"
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('catalog')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'catalog' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                  title="Vista de Catálogo"
                  aria-label="Vista de catálogo"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
              </div>

              {canCreate && (
                <>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors text-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="hidden sm:inline">Importar Excel</span>
                  </button>
                  <button
                    onClick={() => openModal('create')}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Nuevo Teléfono</span>
                  </button>
                </>
              )}
            </div>
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

        {/* Bulk Actions */}
        {phones.length > 0 && <BulkActions phones={phones} />}

        {/* Views */}
        {viewMode === 'list' ? (
          <div className="card overflow-hidden">
            <PhoneTable phones={phones} isLoading={isLoading} error={error} />

            {/* Load More */}
            {hasNextPage && (
              <div className="px-6 py-4 border-t border-gray-100 text-center bg-gray-50">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cargando...
                    </>
                  ) : (
                    `Ver más... (${totalLoaded} cargados)`
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <CatalogView phones={phones} isLoading={isLoading} error={error} />
            {/* Load More for catalog view */}
            {hasNextPage && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cargando...
                    </>
                  ) : (
                    `Ver más... (${totalLoaded} cargados)`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <PhoneModal />
      <PhoneDetailsModal />
      <PaymentModal />
      {showImportModal && (
        <ImportInvoiceModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
}
