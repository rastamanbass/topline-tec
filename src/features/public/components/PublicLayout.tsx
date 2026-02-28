import type { ReactNode } from 'react';
import { ShoppingBag } from 'lucide-react';

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Minimal Header */}
      <header className="bg-white shadow relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary-600" />
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">TopLine Store</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-grow">{children}</main>

      {/* Minimal Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} TopLine Tec. Precios sujetos a cambio sin previo aviso.
        </div>
      </footer>
    </div>
  );
}
