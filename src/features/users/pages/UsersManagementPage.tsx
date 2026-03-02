import { useState } from 'react';
import { Users, Plus, Edit2, Lock, Unlock, Loader2 } from 'lucide-react';
import { useAuth } from '../../../context';
import { Navigate } from 'react-router-dom';
import { useBuyerUsers } from '../hooks/useUsers';
import CreateUserModal from '../components/CreateUserModal';
import { createBuyerUser } from '../services/userService';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { User } from '../../../types';

export default function UsersManagementPage() {
  const { userRole } = useAuth();
  const { data: users, isLoading } = useBuyerUsers();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<{ email: string; password: string } | null>(null);
  const queryClient = useQueryClient();

  // Solo admin/gerente
  if (!['admin', 'gerente'].includes(userRole || '')) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleToggleStatus = async (user: User) => {
    setTogglingUid(user.uid);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isActive: user.isActive === false ? true : false,
      });
      queryClient.invalidateQueries({ queryKey: ['buyerUsers'] });
      toast.success(user.isActive === false ? 'Usuario activado' : 'Usuario desactivado');
    } catch {
      toast.error('Error al actualizar usuario');
    } finally {
      setTogglingUid(null);
    }
  };

  const handleCreateUser = async (data: {
    email: string;
    displayName: string;
    phone: string;
    company?: string;
  }) => {
    const result = await createBuyerUser(data);

    // Refrescar lista de usuarios
    queryClient.invalidateQueries({ queryKey: ['buyerUsers'] });

    setCreatedUser({ email: data.email, password: result.temporaryPassword });
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nuevo Usuario
              </button>
            </div>
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
                          onClick={() => handleToggleStatus(user)}
                          disabled={togglingUid === user.uid}
                          className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                          title={user.isActive !== false ? 'Desactivar' : 'Activar'}
                        >
                          {togglingUid === user.uid ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : user.isActive !== false ? (
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

      {/* Modal de credenciales creadas (CALIDAD-7 incluido aquí) */}
      {createdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Usuario creado</h2>
            <p className="text-sm text-gray-500 mb-4">Comparte estas credenciales de forma segura</p>
            {[
              { label: 'Email', value: createdUser.email },
              { label: 'Contraseña temporal', value: createdUser.password },
            ].map(({ label, value }) => (
              <div key={label} className="mb-3">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <code className="flex-1 text-sm font-mono text-gray-900 break-all">{value}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(value);
                      toast.success('Copiado');
                    }}
                    className="text-primary-600 hover:text-primary-800 text-xs font-medium shrink-0"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => setCreatedUser(null)}
              className="w-full mt-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
