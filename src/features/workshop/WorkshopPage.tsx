import { Wrench, Plus } from 'lucide-react';
import { useState } from 'react';
import 'react-hot-toast'; // Ensure toast is available if needed contextually
import { useWorkshopPhones, useUpdateWorkshopStatus } from './hooks/useWorkshop';
import RepairTicket from './components/RepairTicket';
import StatusBadge from '../inventory/components/StatusBadge';
import { useAuth } from '../../context';
import toast from 'react-hot-toast';

export default function WorkshopPage() {
  const { data: workshopPhones, isLoading, error } = useWorkshopPhones();
  const { mutate: updateStatus } = useUpdateWorkshopStatus();
  const { userRole } = useAuth();
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  const handleAction = (id: string, action: string) => {
    let newStatus = '';
    let details = '';

    switch (action) {
      case 'receive_workshop':
        newStatus = 'En Taller (Recibido)';
        details = 'Recibido en taller';
        break;
      case 'send_management':
        newStatus = 'Enviado a Gerencia (Pendiente)';
        details = 'Enviado a gerencia para revisión';
        break;
      case 'confirm_reception':
        newStatus = 'Enviado a Gerencia';
        details = 'Recepción confirmada por gerencia';
        break;
      case 'deliver_client':
        // TODO: check if client exists logic (simple version for now)
        if (!confirm('¿Confirmar entrega al cliente?')) return;
        newStatus = 'Entregado al Cliente';
        details = 'Entregado al cliente final';
        break;
      default:
        return;
    }

    updateStatus(
      { id, newStatus, details },
      {
        onSuccess: () => toast.success('Estado actualizado correctamente'),
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Wrench className="w-6 h-6 text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Taller</h1>
                <p className="text-sm text-gray-600">Gestión de Reparaciones</p>
              </div>
            </div>

            <button
              onClick={() => setIsTicketModalOpen(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nueva Reparación
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex justify-center p-12">Loading...</div>
        ) : error ? (
          <div className="text-red-600 p-12">Error loading workshop data</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dispositivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reparaciones Pendientes
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workshopPhones?.map((phone) => (
                  <tr key={phone.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {phone.marca} {phone.modelo}
                      </div>
                      <div className="text-sm text-gray-500">IMEI: {phone.imei}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={phone.estado} />
                    </td>
                    <td className="px-6 py-4">
                      {phone.reparaciones?.map((rep, idx) => (
                        <div
                          key={idx}
                          className="text-sm text-gray-700 border-b border-gray-100 last:border-0 py-1"
                        >
                          <span className="font-medium">{rep.note}</span> - ${rep.cost}
                          {!rep.paid && (
                            <span className="ml-2 text-red-500 text-xs font-bold">Unpaid</span>
                          )}
                        </div>
                      ))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {userRole === 'taller' && (
                        <>
                          {(phone.estado === 'Enviado a Taller (Externo)' ||
                            phone.estado === 'Enviado a Taller (Garantía)') && (
                            <button
                              onClick={() => handleAction(phone.id, 'receive_workshop')}
                              className="text-green-600 hover:text-green-900 font-bold"
                            >
                              Marcar Recibido
                            </button>
                          )}
                          {phone.estado === 'En Taller (Recibido)' && (
                            <button
                              onClick={() => handleAction(phone.id, 'send_management')}
                              className="text-purple-600 hover:text-purple-900 font-bold"
                            >
                              Enviar a Gerencia
                            </button>
                          )}
                          {(phone.estado === 'En Taller (Recibido)' ||
                            phone.estado === 'Recibido de Taller (OK)') && (
                            <button
                              onClick={() => handleAction(phone.id, 'deliver_client')}
                              className="text-indigo-600 hover:text-indigo-900 font-bold"
                            >
                              Entregar Cliente
                            </button>
                          )}
                        </>
                      )}
                      {['admin', 'gerente'].includes(userRole || '') && (
                        <>
                          {phone.estado === 'Enviado a Gerencia (Pendiente)' && (
                            <button
                              onClick={() => handleAction(phone.id, 'confirm_reception')}
                              className="text-teal-600 hover:text-teal-900 font-bold"
                            >
                              Confirmar Recepción
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {workshopPhones?.length === 0 && (
              <div className="text-center py-12 text-gray-500">No hay dispositivos en taller.</div>
            )}
          </div>
        )}
      </main>

      {isTicketModalOpen && <RepairTicket onClose={() => setIsTicketModalOpen(false)} />}
    </div>
  );
}
