import { useState } from 'react';
import { Users, Plus, Edit2, Lock, Unlock } from 'lucide-react';
import { useAuth } from '../../../context';
import { Navigate } from 'react-router-dom';
import { useBuyerUsers } from '../hooks/useUsers';
import CreateUserModal from '../components/CreateUserModal';
import { createBuyerUser } from '../services/userService';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export default function UsersManagementPage() {
  const { userRole } = useAuth();
  const { data: users, isLoading } = useBuyerUsers();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Solo admin/gerente
  if (!['admin', 'gerente'].includes(userRole || '')) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleCreateUser = async (data: {
    email: string;
    displayName: string;
    phone: string;
    company?: string;
  }) => {
    const result = await createBuyerUser(data);

    // Refrescar lista de usuarios
    queryClient.invalidateQueries({ queryKey: ['buyerUsers'] });

    toast.success(
      `✅ Usuario creado exitosamente!\n\n📧 Email: ${data.email}\n🔑 Contraseña temporal: ${result.temporaryPassword}\n\n⚠️ Comparte estas credenciales con el cliente`,
      { duration: 10000 }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Usuarios Compradores</h1>
                <p className="text-sm text-gray-600">Gestión de clientes B2B</p>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Usuario
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            {isLoading ? (
              <p className="text-center py-8 text-gray-500">Cargando usuarios...</p>
            ) : users && users.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.uid} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.isActive !== false
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.isActive !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          className="text-primary-600 hover:text-primary-900 mr-3"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          className="text-gray-600 hover:text-gray-900"
                          title={user.isActive !== false ? 'Desactivar' : 'Activar'}
                        >
                          {user.isActive !== false ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No hay usuarios compradores
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Comienza creando un nuevo usuario con el botón "+ Nuevo Usuario"
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <CreateUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateUser}
      />
    </div>
  );
}
