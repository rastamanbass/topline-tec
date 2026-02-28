import PublicCatalogPage from './PublicCatalogPage';
import { useAuth } from '../../../context';

export default function ClientStorePage() {
  // This wrapper just ensures we are in the right context or adds specific Client Header overrides if needed.
  // Since PublicCatalogPage now uses useAuth() inside its children hooks (useReservations),
  // it will automatically behave as "Authenticated Store" when accessed by a logged in user.

  // We could add extra UI here like "Welcome Back, [User]" banner.

  const { userRole } = useAuth();

  // Guardian safety check (though ProtectedRoute should handle this)
  if (userRole && userRole !== 'comprador') {
    // Admins viewing this page? Sure, why not.
  }

  return <PublicCatalogPage />;
}
