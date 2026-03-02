import { Edit2, Trash2, Eye, Phone, Mail, Users } from 'lucide-react';

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700','bg-emerald-100 text-emerald-700','bg-purple-100 text-purple-700',
  'bg-orange-100 text-orange-700','bg-pink-100 text-pink-700','bg-teal-100 text-teal-700',
];
function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name: string) {
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
}
import { useClients, useDeleteClient } from '../hooks/useClients';
import { useAuth } from '../../../context';
import type { Client } from '../../../types';

interface ClientTableProps {
  searchQuery: string;
  onEdit: (client: Client) => void;
  onView?: (client: Client) => void;
}

export default function ClientTable({ searchQuery, onEdit, onView }: ClientTableProps) {
  const { data: clients, isLoading } = useClients();
  const deleteClient = useDeleteClient();
  const { userRole } = useAuth();

  const canDelete = userRole === 'admin';
  const canEdit = ['admin', 'gerente'].includes(userRole || '');

  // Filter clients
  const filteredClients = clients?.filter((client) => {
    const query = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(query) ||
      client.phone?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query)
    );
  });

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar al cliente "${name}"?`)) {
      await deleteClient.mutateAsync(id);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="overflow-x-auto animate-pulse">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>{['w-36','w-40','w-24','w-24','w-20','w-20'].map((w,i)=>(
              <th key={i} className="px-6 py-3"><div className={`h-3 bg-gray-200 rounded ${w}`}/></th>
            ))}</tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {[...Array(5)].map((_,i)=>(
              <tr key={i}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0"/>
                    <div className="h-3.5 bg-gray-200 rounded w-28"/>
                  </div>
                </td>
                <td className="px-6 py-4"><div className="h-3.5 bg-gray-200 rounded w-32"/></td>
                <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-16"/></td>
                <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-16"/></td>
                <td className="px-6 py-4"><div className="h-3.5 bg-gray-200 rounded w-14"/></td>
                <td className="px-6 py-4 text-right"><div className="h-7 bg-gray-200 rounded w-20 ml-auto"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!filteredClients?.length) {
    return (
      <div className="text-center py-16 flex flex-col items-center gap-3">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <Users className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-gray-600 font-medium">No se encontraron clientes</p>
        <p className="text-sm text-gray-400">Intenta ajustar la búsqueda o crea un cliente nuevo</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200" aria-label="Lista de clientes">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nombre
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Contacto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Crédito
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Deuda
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tipo
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredClients.map((client) => (
            <tr key={client.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getAvatarColor(client.name)}`}>
                    {getInitials(client.name)}
                  </div>
                  <div className="text-sm font-medium text-gray-900">{client.name}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500 flex flex-col gap-1">
                  {client.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {client.phone}
                    </span>
                  )}
                  {client.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {client.email}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                  {formatCurrency(client.creditAmount || 0)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`text-sm font-medium px-2 py-1 rounded-full ${client.debtAmount > 0 ? 'text-red-600 bg-red-50' : 'text-gray-500'}`}
                >
                  {formatCurrency(client.debtAmount || 0)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {client.isWorkshopAccount ? (
                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                    Taller
                  </span>
                ) : (
                  'Regular'
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onView?.(client)}
                    className="text-blue-600 hover:text-blue-900"
                    aria-label={`Ver detalles de ${client.name}`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => onEdit(client)}
                      className="text-indigo-600 hover:text-indigo-900"
                      aria-label={`Editar ${client.name}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(client.id, client.name)}
                      className="text-red-600 hover:text-red-900"
                      aria-label={`Eliminar ${client.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
