import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, type UserRole } from '../context';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access — deny if role not loaded yet or not in allowed list
  if (allowedRoles && (!userRole || !allowedRoles.includes(userRole))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600 mb-6">No tienes permisos para acceder a esta página.</p>
          <button onClick={() => window.history.back()} className="btn-primary">
            Volver
          </button>
        </div>
      </div>
    );
  }

  // Render children if authenticated and authorized
  return <>{children}</>;
}
