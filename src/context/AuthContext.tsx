import { createContext, useEffect, useState, type ReactNode } from 'react';
import {
  type User,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// User roles type
export type UserRole = 'admin' | 'gerente' | 'vendedor' | 'comprador' | 'taller';

// Extended user type with role
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: UserRole;
  clientId?: string;
}

// Auth context type
export interface AuthContextType {
  user: AuthUser | null;
  userRole: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth provider component
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        try {
          // Fetch user role from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserRole(userData.role as UserRole);

            // Create simplified user object
            const authUser: AuthUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName:
                userData.name || firebaseUser.displayName || firebaseUser.email || 'User',
              role: userData.role,
              clientId: userData.clientId,
            };

            setUser(authUser);
          } else {
            // User document doesn't exist in Firestore
            console.warn('User document not found in Firestore. Checking fallbacks...');

            let role: UserRole | null = null;
            let name = 'User';

            // TODO: Remove emergency fallbacks before production
            // Emergency Fallback for known admins/legacy users
            if (firebaseUser.email === 'admin@toplinetecinc.com') {
              role = 'admin';
              name = 'Admin Master';
            } else if (firebaseUser.email === 'gerencia1@toplinetec.com') {
              role = 'gerente';
              name = 'Gerencia';
            }

            if (role) {
              // Auto-fix: Create the missing document
              const { setDoc } = await import('firebase/firestore');
              await setDoc(doc(db, 'users', firebaseUser.uid), {
                email: firebaseUser.email,
                name,
                role,
                createdAt: new Date(),
                legacy: true,
              });

              setUserRole(role);
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: name,
                role,
              });
            } else {
              console.error('No fallback role found for user.');
              setUser(null);
              setUserRole(null);
            }
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setUser(null);
          setUserRole(null);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle the rest
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    userRole,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
