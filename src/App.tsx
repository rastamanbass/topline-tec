import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context';
import ProtectedRoute from './components/ProtectedRoute';
import BottomNav from './components/layout/BottomNav';
import LoginPage from './features/auth/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const InventoryPage = lazy(() => import('./features/inventory/InventoryPage'));
const ClientsPage = lazy(() => import('./features/clients/ClientsPage'));
const WorkshopPage = lazy(() => import('./features/workshop/WorkshopPage'));
const PublicCatalogPage = lazy(() => import('./features/public/pages/PublicCatalogPage'));
const ClientStorePage = lazy(() => import('./features/public/pages/ClientStorePage'));
const UsersManagementPage = lazy(() => import('./features/users/pages/UsersManagementPage'));
const CatalogPage = lazy(() => import('./features/catalog/CatalogPage'));
const FinancePage = lazy(() => import('./features/finance/FinancePage'));
const SalesHistoryPage = lazy(() => import('./features/sales/SalesHistoryPage'));
const AccessoriesPage = lazy(() => import('./features/accessories/AccessoriesPage'));
const ReceivingPage = lazy(() => import('./features/receiving/ReceivingPage'));
const InsightsPage = lazy(() => import('./features/insights/InsightsPage'));

// Payments & Orders
const CheckoutSuccessPage = lazy(
  () => import('./features/public/pages/CheckoutSuccessPage')
);
const CheckoutCancelPage = lazy(
  () => import('./features/public/pages/CheckoutCancelPage')
);
const MyOrdersPage = lazy(() => import('./features/public/pages/MyOrdersPage'));
const OrdersPage = lazy(() => import('./features/orders/OrdersPage'));
const LoteClientViewPage = lazy(() => import('./features/inventory/pages/LoteClientViewPage'));
const SupplierInvoicesPage = lazy(() => import('./features/supplier-invoices/SupplierInvoicesPage'));
const SuppliersPage = lazy(() => import('./features/suppliers/SuppliersPage'));
const ImportShipmentsPage = lazy(() => import('./features/import-shipments/ImportShipmentsPage'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
  </div>
);

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <BottomNav />
            <Routes>
              {/* Root Redirect Logic */}
              <Route path="/" element={<RootRedirect />} />

              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/catalogo" element={<PublicCatalogPage />} />
              <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
              <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />

              {/* Buyer portal — requires auth but open to all roles */}
              <Route
                path="/mis-pedidos"
                element={
                  <ProtectedRoute>
                    <MyOrdersPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/inventory"
                element={
                  <ProtectedRoute>
                    <InventoryPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/clients"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente', 'vendedor', 'taller']}>
                    <ClientsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/catalog"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente', 'vendedor']}>
                    <CatalogPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/taller"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente', 'taller']}>
                    <WorkshopPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/usuarios"
                element={
                  <ProtectedRoute>
                    <UsersManagementPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/store"
                element={
                  <ProtectedRoute allowedRoles={['comprador', 'admin', 'gerente']}>
                    <ClientStorePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/finanzas"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                    <FinancePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ventas"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                    <SalesHistoryPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/accesorios"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente', 'vendedor', 'taller']}>
                    <AccessoriesPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/recepcion"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente', 'comprador']}>
                    <ReceivingPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/insights"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                    <InsightsPage />
                  </ProtectedRoute>
                }
              />

              {/* Lote client view — shareable per-lot summary */}
              <Route
                path="/lote/:loteId"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente', 'vendedor']}>
                    <LoteClientViewPage />
                  </ProtectedRoute>
                }
              />

              {/* Admin: Orders panel */}
              <Route
                path="/ordenes"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                    <OrdersPage />
                  </ProtectedRoute>
                }
              />

              {/* Suppliers Management */}
              <Route
                path="/suppliers"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente', 'comprador']}>
                    <SuppliersPage />
                  </ProtectedRoute>
                }
              />

              {/* Supplier Invoices */}
              <Route
                path="/supplier-invoices"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                    <SupplierInvoicesPage />
                  </ProtectedRoute>
                }
              />

              {/* Import Shipments (USA → El Salvador) */}
              <Route
                path="/envios"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                    <ImportShipmentsPage />
                  </ProtectedRoute>
                }
              />

              {/* Default redirect */}
              {/* <Route path="/" element={<Navigate to="/dashboard" replace />} /> Replaced by RootRedirect */}

              {/* 404 */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </BrowserRouter>

        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#333',
              color: '#fff',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootRedirect() {
  const { user, userRole, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Cargando...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;

  if (userRole === 'comprador') {
    return <Navigate to="/store" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

export default App;
