import { useAuth } from '../../context';
import {
  LogOut,
  User,
  Smartphone,
  Users,
  PenTool,
  AlertCircle,
  Clock,
  TrendingUp,
  ShoppingBag,
  Package,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDashboardStats } from './hooks/useDashboardStats';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

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

          <DashboardStats userRole={userRole || undefined} />

          {/* Placeholder for dashboard content */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/inventory"
              className="card hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center justify-center p-6 text-center group"
            >
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary-200 transition-colors">
                <Smartphone className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Inventario</h3>
              <p className="text-sm text-gray-500">Gestionar teléfonos y stock</p>
            </Link>

            <Link
              to="/clients"
              className="card hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center justify-center p-6 text-center group"
            >
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Clientes</h3>
              <p className="text-sm text-gray-500">Directorio y créditos</p>
            </Link>

            <Link
              to="/catalog"
              className="card hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center justify-center p-6 text-center group"
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-emerald-200 transition-colors">
                {/* Re-using PenTool or importing Tag from lucide if available. Using PenTool generic if Tag not imported. */}
                {/* Let's verify imports in DashboardPage first. I will assume I can edit imports or use existing icons. */}
                <Smartphone className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Catálogo</h3>
              <p className="text-sm text-gray-500">Precios y Modelos</p>
            </Link>

            <Link
              to="/taller"
              className="card hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center justify-center p-6 text-center group"
            >
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
                <PenTool className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Taller</h3>
              <p className="text-sm text-gray-500">Reparaciones y servicios</p>
            </Link>

            {/* Accesorios */}
            <Link
              to="/accesorios"
              className="card hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center justify-center p-6 text-center group"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Accesorios</h3>
              <p className="text-sm text-gray-500">Cables, cases, cargadores</p>
            </Link>

            {/* Finanzas - Solo Admin/Gerente */}
            {['admin', 'gerente'].includes(userRole || '') && (
              <Link
                to="/finanzas"
                className="card hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center justify-center p-6 text-center group"
              >
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-emerald-200 transition-colors">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Finanzas</h3>
                <p className="text-sm text-gray-500">P&amp;L, márgenes, reportes</p>
              </Link>
            )}

            {/* Historial de Ventas - Solo Admin/Gerente */}
            {['admin', 'gerente'].includes(userRole || '') && (
              <Link
                to="/ventas"
                className="card hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center justify-center p-6 text-center group"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                  <ShoppingBag className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Ventas</h3>
                <p className="text-sm text-gray-500">Historial de transacciones</p>
              </Link>
            )}

            {/* Usuarios - Solo Admin/Gerente */}
            {['admin', 'gerente'].includes(userRole || '') && (
              <Link
                to="/admin/usuarios"
                className="card hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center justify-center p-6 text-center group"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-gray-200 transition-colors">
                  <User className="w-6 h-6 text-gray-600" />
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

function DashboardStats({ userRole }: { userRole: string | undefined }) {
  const { stats, isLoading } = useDashboardStats();

  if (isLoading || !stats)
    return <div className="mb-8 animate-pulse h-24 bg-gray-100 rounded-lg"></div>;

  if (userRole === 'taller') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
          <div className="flex items-center gap-2 mb-2 text-yellow-800">
            <Clock className="w-4 h-4" />
            <h3 className="font-medium text-sm">Pendientes de Recibir</h3>
          </div>
          <p className="text-2xl font-bold text-yellow-900">{stats.pendingReception}</p>
        </div>
        <div className="bg-pink-50 p-4 rounded-lg border border-pink-100">
          <div className="flex items-center gap-2 mb-2 text-pink-800">
            <PenTool className="w-4 h-4" />
            <h3 className="font-medium text-sm">En Reparación</h3>
          </div>
          <p className="text-2xl font-bold text-pink-900">{stats.inRepair}</p>
        </div>
        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
          <div className="flex items-center gap-2 mb-2 text-indigo-800">
            <AlertCircle className="w-4 h-4" />
            <h3 className="font-medium text-sm">Listos para Gerencia</h3>
          </div>
          <p className="text-2xl font-bold text-indigo-900">{stats.pendingManagementReception}</p>
        </div>
        <div className="bg-gray-100 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2 text-gray-700">
            <Wrench className="w-4 h-4" />
            <h3 className="font-medium text-sm">Total en Proceso</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.inWorkshop}</p>
        </div>
      </div>
    );
  }

  // Admin / Gerente / Vendedor (Generic view with finances)
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <h3 className="text-gray-500 text-sm font-medium">Ganancia Bruta</h3>
        <p className="text-2xl font-bold mt-1 text-green-600">
          {formatCurrency(stats.totalProfit)}
        </p>
      </div>
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <h3 className="text-gray-500 text-sm font-medium">Ingresos Totales</h3>
        <p className="text-2xl font-bold mt-1 text-gray-900">
          {formatCurrency(stats.totalRevenue)}
        </p>
      </div>
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <h3 className="text-gray-500 text-sm font-medium">En Stock</h3>
        <p className="text-2xl font-bold mt-1 text-blue-600">{stats.inStock}</p>
      </div>
      {(userRole === 'admin' || userRole === 'gerente') && stats.workshopDebt > 0 && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
          <h3 className="text-red-800 text-sm font-medium">Deuda Taller Pendiente</h3>
          <p className="text-2xl font-bold mt-1 text-red-600">
            {formatCurrency(stats.workshopDebt)}
          </p>
        </div>
      )}
    </div>
  );
}

function Wrench({ className }: { className?: string }) {
  return <PenTool className={className} />;
}
