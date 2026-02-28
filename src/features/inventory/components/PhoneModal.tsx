import { X } from 'lucide-react';
import { useState } from 'react';
import { useInventoryStore } from '../stores/inventoryStore';
import ManualForm from './ManualForm';
import ScannerView from './ScannerView';

export default function PhoneModal() {
  const { isModalOpen, modalMode, closeModal, initialBatch } = useInventoryStore();
  const [entryMode, setEntryMode] = useState<'scanner' | 'manual'>('scanner');

  if (!isModalOpen || modalMode === 'view') return null;

  // Header Content
  const renderHeader = () => (
    <div className="flex items-center justify-between p-6 border-b border-gray-200">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-gray-900">
          {modalMode === 'create' ? 'Nuevo Ingreso' : 'Editar Teléfono'}
        </h2>
      </div>

      <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
        <X className="w-6 h-6" />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {/* Dynamic Width: Wider for Scanner Mode (Create), Narrower for Edit */}
      <div
        className={`bg-white rounded-lg shadow-xl w-full transition-all duration-300 ${modalMode === 'create' ? 'max-w-5xl h-[90vh]' : 'max-w-2xl max-h-[90vh] overflow-y-auto'}`}
      >
        {modalMode === 'create' ? (
          <div className="h-full flex flex-col bg-gray-50">
            {/* Header with Tabs */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-6">
                <h2 className="text-xl font-bold text-gray-900">Ingreso de Inventario</h2>

                {/* Tabs */}
                <div className="flex bg-gray-100 p-1.5 rounded-lg">
                  <button
                    onClick={() => setEntryMode('scanner')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${entryMode === 'scanner' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    📷 Escáner
                  </button>
                  <button
                    onClick={() => setEntryMode('manual')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${entryMode === 'manual' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    ✍️ Manual
                  </button>
                </div>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {entryMode === 'scanner' ? (
                <ScannerView
                  onCancel={closeModal}
                  onSuccess={closeModal}
                  initialBatch={initialBatch}
                />
              ) : (
                <div className="p-6 h-full overflow-y-auto">
                  <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <ManualForm onCancel={closeModal} onSuccess={closeModal} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Edit Mode (Classic Form)
          <>
            {renderHeader()}
            <ManualForm onCancel={closeModal} onSuccess={closeModal} />
          </>
        )}
      </div>
    </div>
  );
}
