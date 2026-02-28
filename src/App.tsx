import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';

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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Root Redirect Logic */}
              <Route path="/" element={<RootRedirect />} />

              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/catalogo" element={<PublicCatalogPage />} />

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
                  <ProtectedRoute>
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
                  <ProtectedRoute>
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
                  <ProtectedRoute>
                    <AccessoriesPage />
                  </ProtectedRoute>
                }
              />

              {/* Default redirect */}
              {/* <Route path="/" element={<Navigate to="/dashboard" replace />} /> Replaced by RootRedirect */}

              {/* 404 */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
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

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (userRole === 'comprador') {
    return <Navigate to="/store" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

export default App;
