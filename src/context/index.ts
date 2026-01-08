import { useContext } from 'react';
import {
  AuthContext,
  AuthProvider,
  type UserRole,
  type AuthUser,
  type AuthContextType,
} from './AuthContext';

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Re-export everything
export { AuthProvider, type UserRole, type AuthUser, type AuthContextType };
