import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import toast from 'react-hot-toast';
import { Lock, Mail } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user, userRole } = useAuth();
  const navigate = useNavigate();

  // Navigate once auth state is confirmed (after onAuthStateChanged resolves)
  useEffect(() => {
    if (user) {
      if (userRole === 'comprador') navigate('/store', { replace: true });
      else navigate('/dashboard', { replace: true });
    }
  }, [user, userRole, navigate]);

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Ingresa tu email primero');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Email de recuperación enviado. Revisa tu bandeja.');
    } catch {
      toast.error('No se pudo enviar el email. Verifica la dirección.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('¡Bienvenido!');
      // Navigation is handled by useEffect once onAuthStateChanged resolves
    } catch (error) {
      console.error('Login error:', error);

      // Handle specific Firebase errors
      const firebaseError = error as { code?: string };

      if (
        firebaseError.code === 'auth/invalid-credential' ||
        firebaseError.code === 'auth/wrong-password'
      ) {
        toast.error('Email o contraseña incorrectos');
      } else if (firebaseError.code === 'auth/user-not-found') {
        toast.error('Usuario no encontrado');
      } else if (firebaseError.code === 'auth/too-many-requests') {
        toast.error('Demasiados intentos. Intenta más tarde');
      } else {
        toast.error('Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600 mb-2">Top Line Tec</h1>
          <p className="text-gray-600">Sistema de Gestión Mayorista</p>
        </div>

        {/* Login Card */}
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Iniciar Sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10"
                  placeholder="tu@email.com"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10"
                  placeholder="••••••••"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-primary-600 hover:underline mt-1 block mx-auto"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-4">
          © {new Date().getFullYear()} Top Line Tec. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
