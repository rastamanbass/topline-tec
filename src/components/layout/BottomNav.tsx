import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Smartphone,
  Users,
  Wrench,
  MoreHorizontal,
  ShoppingBag,
  Package,
  TrendingUp,
  PackageCheck,
  ScanBarcode,
  UserCog,
  X,
  FileSpreadsheet,
  Building2,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../context';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  roles?: string[];
}

const MAIN_TABS: NavItem[] = [
  {
    to: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    label: 'Inicio',
  },
  {
    to: '/inventory',
    icon: <Smartphone className="w-5 h-5" />,
    label: 'Inventario',
  },
  {
    to: '/clients',
    icon: <Users className="w-5 h-5" />,
    label: 'Clientes',
    roles: ['admin', 'gerente', 'vendedor'],
  },
  {
    to: '/taller',
    icon: <Wrench className="w-5 h-5" />,
    label: 'Taller',
    roles: ['admin', 'gerente', 'taller'],
  },
];

const MORE_ITEMS: NavItem[] = [
  {
    to: '/envios',
    icon: <Truck className="w-5 h-5 text-indigo-600" />,
    label: 'Envíos',
    roles: ['admin', 'gerente'],
  },
  {
    to: '/recepcion',
    icon: <PackageCheck className="w-5 h-5 text-teal-600" />,
    label: 'Recepción',
    roles: ['admin', 'gerente', 'comprador'],
  },
  {
    to: '/catalog',
    icon: <ScanBarcode className="w-5 h-5 text-emerald-600" />,
    label: 'Catálogo',
    roles: ['admin', 'gerente', 'vendedor'],
  },
  {
    to: '/ventas',
    icon: <ShoppingBag className="w-5 h-5 text-blue-600" />,
    label: 'Ventas',
    roles: ['admin', 'gerente'],
  },
  {
    to: '/finanzas',
    icon: <TrendingUp className="w-5 h-5 text-green-600" />,
    label: 'Finanzas',
    roles: ['admin', 'gerente'],
  },
  {
    to: '/accesorios',
    icon: <Package className="w-5 h-5 text-purple-600" />,
    label: 'Accesorios',
  },
  {
    to: '/admin/usuarios',
    icon: <UserCog className="w-5 h-5 text-gray-500" />,
    label: 'Usuarios',
    roles: ['admin'],
  },
  {
    to: '/suppliers',
    icon: <Building2 className="w-5 h-5 text-indigo-600" />,
    label: 'Proveedores',
    roles: ['admin', 'gerente', 'comprador'],
  },
  {
    to: '/supplier-invoices',
    icon: <FileSpreadsheet className="w-5 h-5 text-teal-600" />,
    label: 'Facturas Prov.',
    roles: ['admin', 'gerente'],
  },
];

// Pages where BottomNav should NOT appear
const HIDDEN_ON = ['/login', '/catalogo'];

export default function BottomNav() {
  const location = useLocation();
  const { user, userRole } = useAuth();
  const [showMore, setShowMore] = useState(false);

  // Hide on public pages or when not logged in
  if (!user || HIDDEN_ON.some((p) => location.pathname.startsWith(p))) return null;

  const isActive = (to: string) =>
    to === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(to);

  const canAccess = (item: NavItem) =>
    !item.roles || item.roles.includes(userRole || '');

  const visibleTabs = MAIN_TABS.filter(canAccess);
  const visibleMore = MORE_ITEMS.filter(canAccess);

  return (
    <>
      {/* More overlay */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setShowMore(false)}
        >
          <div
            className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-5 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Más módulos
              </p>
              <button
                onClick={() => setShowMore(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {visibleMore.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setShowMore(false)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${
                    isActive(item.to)
                      ? 'bg-primary-50 text-primary-600'
                      : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {item.icon}
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="max-w-lg mx-auto flex items-center h-16 px-2">
          {visibleTabs.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all ${
                  active
                    ? 'text-primary-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <span
                  className={`transition-transform ${active ? 'scale-110' : ''}`}
                >
                  {item.icon}
                </span>
                <span
                  className={`text-[10px] font-medium transition-all ${
                    active ? 'text-primary-600' : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-full" />
                )}
              </Link>
            );
          })}

          {/* Más button */}
          {visibleMore.length > 0 && (
            <button
              onClick={() => setShowMore((v) => !v)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all ${
                showMore ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium">Más</span>
            </button>
          )}
        </div>
      </nav>

      {/* Spacer so content doesn't hide behind nav */}
      <div className="h-16" />
    </>
  );
}
