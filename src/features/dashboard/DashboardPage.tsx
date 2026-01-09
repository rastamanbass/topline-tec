import { useAuth } from '../../context';
import { LogOut, User, Smartphone, Users, PenTool } from 'lucide-react';
import { Link } from 'react-router-dom';
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
            <Link to="/inventory" className="card hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center justify-center p-6 text-center group">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary-200 transition-colors">
                <Smartphone className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Inventario</h3>
              <p className="text-sm text-gray-500">Gestionar teléfonos y stock</p>
            </Link>

            <Link to="/clients" className="card hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center justify-center p-6 text-center group">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Clientes</h3>
              <p className="text-sm text-gray-500">Directorio y créditos</p>
            </Link>

            <Link to="/taller" className="card hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center justify-center p-6 text-center group">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
                <PenTool className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Taller</h3>
              <p className="text-sm text-gray-500">Reparaciones y servicios</p>
            </Link>

            {/* Usuarios - Solo Admin/Gerente */}
            {['admin', 'gerente'].includes(userRole || '') && (
              <Link to="/admin/usuarios" className="card hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center justify-center p-6 text-center group">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                  <User className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Usuarios</h3>
                <p className="text-sm text-gray-500">Gestión de compradores B2B</p>
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
