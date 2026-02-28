import { Package, Plus, LayoutGrid, List, MonitorPlay } from 'lucide-react';
import SearchBar from './components/SearchBar';
import Filters from './components/Filters';
import PhoneTable from './components/PhoneTable';
import CatalogView from './components/CatalogView'; // Added import
import { SeederButton } from './components/SeederButton';
import { DataRepairButton } from './components/DataRepairButton';
import { BrainInjector } from './components/BrainInjector';
import PhoneModal from './components/PhoneModal';
import PhoneDetailsModal from './components/PhoneDetailsModal';
import BulkActions from './components/BulkActions';
import PaymentModal from '../sales/components/PaymentModal';

import { useInventoryStore } from './stores/inventoryStore';
import { usePhones } from './hooks/usePhones';
import { useAuth } from '../../context';

export default function InventoryPage() {
  const {
    openModal,
    searchQuery,
    selectedLot,
    selectedStatus,
    viewMode,
    setViewMode,
    clientViewMode,
    setClientViewMode,
  } = useInventoryStore(); // Added viewMode, setViewMode
  const { userRole } = useAuth();

  // ... fetch logic ...
  const {
    data: phones,
    isLoading,
    error,
  } = usePhones({
    lot: selectedLot,
    status: selectedStatus,
    searchQuery,
  });

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

            <div className="flex items-center gap-4">
              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p - 1.5 rounded - md transition - all ${viewMode === 'list' && !clientViewMode ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'} `}
                  title="Vista de Lista"
                  disabled={clientViewMode}
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('catalog')}
                  className={`p - 1.5 rounded - md transition - all ${viewMode === 'catalog' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'} `}
                  title="Vista de Catálogo"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
              </div>

              {/* Demo Button */}
              <button
                onClick={async () => {
                  if (window.confirm('¿Generar 50 teléfonos de prueba?')) {
                    const { seedDatabase } = await import('../../utils/seedData');
                    await seedDatabase();
                    alert('¡Datos generados!');
                    window.location.reload();
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
              >
                <span className="text-sm font-bold">⚡ Demo</span>
              </button>

              {/* Shuffle Conditions Button */}
              <button
                onClick={async () => {
                  if (window.confirm('¿Asignar condiciones aleatorias a TODOS los teléfonos?')) {
                    const { randomizeConditions } = await import('../../utils/seedData');
                    await randomizeConditions();
                    alert('¡Condiciones actualizadas!');
                    window.location.reload();
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                title="Aleatorizar condiciones de teléfonos existentes"
              >
                <span className="text-sm font-bold">🎲 Mix</span>
              </button>

              {/* Client Mode Toggle */}
              <button
                onClick={() => {
                  const newState = !clientViewMode;
                  setClientViewMode(newState);
                  if (newState) setViewMode('catalog'); // Start catalog mode on client view
                }}
                className={`flex items - center gap - 2 px - 3 py - 1.5 rounded - lg border transition - all ${
                  clientViewMode
                    ? 'bg-purple-100 border-purple-200 text-purple-700 font-bold shadow-inner'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                } `}
                title="Activar Vista Cliente (Ocultar herramientas)"
              >
                <MonitorPlay className="w-4 h-4" />
                <span className="text-sm">
                  {clientViewMode ? 'Modo Cliente ON' : 'Vista Cliente'}
                </span>
              </button>

              {canCreate && !clientViewMode && (
                <div className="flex gap-2">
                  <BrainInjector />
                  <DataRepairButton />
                  <SeederButton />
                  <button
                    onClick={() => openModal('create')}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Nuevo Teléfono</span>
                  </button>
                </div>
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

        {/* Bulk Actions (Visible in both views if items selected) */}
        {phones && !clientViewMode && <BulkActions phones={phones} />}

        {/* Views */}
        {viewMode === 'list' ? (
          <div className="card overflow-hidden">
            <PhoneTable phones={phones || []} isLoading={isLoading} error={error} />
          </div>
        ) : (
          <CatalogView phones={phones || []} isLoading={isLoading} error={error} />
        )}
      </main>

      {/* Modals */}
      <PhoneModal />
      <PhoneDetailsModal />
      <PaymentModal />
    </div>
  );
}
