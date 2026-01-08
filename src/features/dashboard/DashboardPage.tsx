import { useAuth } from '../../context';
import { LogOut, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user, userRole, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Sesión cerrada');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Error al cerrar sesión');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">Top Line Tec</h1>
              <p className="text-sm text-gray-600">Sistema de Gestión Mayorista</p>
            </div>

            <div className="flex items-center gap-4">
              {/* User Info */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-600" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.displayName}</p>
                  <p className="text-xs text-gray-500 capitalize">{userRole}</p>
                </div>
              </div>

              {/* Logout Button */}
              <button onClick={handleSignOut} className="btn-secondary flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            ¡Bienvenido, {user?.displayName}!
          </h2>
          <p className="text-gray-600 mb-6">Has iniciado sesión correctamente en el sistema.</p>

          {/* Placeholder for dashboard content */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-primary-50 rounded-lg p-6">
              <h3 className="font-semibold text-primary-900 mb-2">Inventario</h3>
              <p className="text-sm text-primary-700">Próximamente</p>
            </div>

            <div className="bg-green-50 rounded-lg p-6">
              <h3 className="font-semibold text-green-900 mb-2">Clientes</h3>
              <p className="text-sm text-green-700">Próximamente</p>
            </div>

            <div className="bg-orange-50 rounded-lg p-6">
              <h3 className="font-semibold text-orange-900 mb-2">Ventas</h3>
              <p className="text-sm text-orange-700">Próximamente</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
