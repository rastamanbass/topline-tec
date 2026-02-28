import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './features/dashboard/DashboardPage';
import InventoryPage from './features/inventory/InventoryPage';
import ClientsPage from './features/clients/ClientsPage';
import WorkshopPage from './features/workshop/WorkshopPage';
import PublicCatalogPage from './features/public/pages/PublicCatalogPage';
import ClientStorePage from './features/public/pages/ClientStorePage';
import UsersManagementPage from './features/users/pages/UsersManagementPage';
import CatalogPage from './features/catalog/CatalogPage';

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

            {/* Default redirect */}
            {/* <Route path="/" element={<Navigate to="/dashboard" replace />} /> Replaced by RootRedirect */}

            {/* 404 */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
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
