import { X, Calendar, DollarSign, Package } from 'lucide-react';
import { useClientPurchases } from '../hooks/useClients';
import type { Client } from '../../../types';

interface ClientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
}

export default function ClientDetailsModal({ isOpen, onClose, client }: ClientDetailsModalProps) {
  const { data: purchases, isLoading } = useClientPurchases(client.id);

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-SV', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{client.name}</h2>
            <p className="text-gray-500 text-sm mt-1">{client.email || client.phone}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-full">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-600 font-medium">Crédito Disponible</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(client.creditAmount)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 p-2 rounded-full">
                  <DollarSign className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-red-600 font-medium">Deuda Actual</p>
                  <p className="text-2xl font-bold text-red-700">
                    {formatCurrency(client.debtAmount)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Historial de Compras
          </h3>

          {isLoading ? (
            <p className="text-gray-500">Cargando historial...</p>
          ) : purchases && purchases.length > 0 ? (
            <div className="space-y-4">
              {(
                purchases as Array<{
                  id: string;
                  purchaseDate: Date;
                  totalAmount: number;
                  items: { description?: string; imei?: string; quantity: number }[];
                  paymentMethod: string;
                  amountPaidWithCredit?: number;
                }>
              ).map((purchase) => (
                <div
                  key={purchase.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-900">Compra #{purchase.id.slice(0, 6)}</p>
                      <p className="text-sm text-gray-500">{formatDate(purchase.purchaseDate)}</p>
                    </div>
                    <span className="font-bold text-gray-900">
                      {formatCurrency(purchase.totalAmount)}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 mt-2 space-y-1">
                    {purchase.items.map((item, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Package className="w-3 h-3 text-gray-400" />
                        <span>{item.description || item.imei}</span>
                        <span className="text-gray-400">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 text-xs text-gray-500 flex gap-2">
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      Método: {purchase.paymentMethod}
                    </span>
                    {(purchase.amountPaidWithCredit ?? 0) > 0 && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                        Crédito usado: {formatCurrency(purchase.amountPaidWithCredit ?? 0)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500">No hay historial de compras</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
