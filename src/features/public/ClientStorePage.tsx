import { Smartphone, Search, Monitor, ArrowRight } from 'lucide-react';
import { usePublicPhones } from './hooks/usePublicPhones';
import PhoneCard from '../inventory/components/PhoneCard';
import FloatingCart from './components/FloatingCart';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ClientStorePage() {
  const { data: phones = [], isLoading } = usePublicPhones();
  const [selectedBrand, setSelectedBrand] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique brands
  const brands = useMemo(() => {
    const all = Array.from(new Set(phones.map((p) => p.marca))).sort();
    return ['Todos', ...all];
  }, [phones]);

  // Filter
  const filteredPhones = useMemo(() => {
    return phones.filter((p) => {
      const matchBrand = selectedBrand === 'Todos' || p.marca === selectedBrand;
      const matchSearch =
        p.modelo.toLowerCase().includes(searchQuery.toLowerCase()) || p.imei.includes(searchQuery);
      return matchBrand && matchSearch;
    });
  }, [phones, selectedBrand, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-primary-200 text-slate-900">
      {/* Hero Section (Apple Style) */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-600 rounded-xl text-white shadow-lg shadow-primary-500/30">
              <Smartphone className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
              TopLine Store
            </h1>
          </div>

          {/* Search Bar (Pill) */}
          <div className="hidden md:flex items-center bg-slate-100 rounded-full px-4 py-2 w-96 border border-transparent focus-within:border-primary-500 focus-within:bg-white transition-all">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Buscar iPhone 13, Samsung S24..."
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="text-sm font-medium text-slate-500 hover:text-primary-600 transition-colors">
              Soporte
            </button>
          </div>
        </div>

        {/* Brand Nav (Horizontal Scroll) */}
        <div className="max-w-7xl mx-auto px-4 border-t border-slate-100 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 h-14">
            {brands.map((brand) => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`
                            px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                            ${
                              selectedBrand === brand
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'text-slate-600 hover:bg-slate-100'
                            }
                        `}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Marketing Banner (Only if showing all) */}
        {selectedBrand === 'Todos' && !searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-12 rounded-3xl overflow-hidden relative bg-slate-900 text-white h-[300px] flex items-center"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary-900 to-indigo-900 opacity-90" />
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1616348436168-de43ad0db179?auto=format&fit=crop&q=80')] bg-cover bg-center mix-blend-overlay opacity-30" />

            <div className="relative z-10 px-12 max-w-2xl">
              <span className="inline-block px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold tracking-wider mb-4 border border-white/20">
                NUEVA COLECCIÓN
              </span>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
                Tecnología Premium. <br />
                <span className="text-primary-400">Precios Mayoristas.</span>
              </h2>
              <p className="text-slate-300 text-lg mb-8 max-w-lg">
                Encuentra los mejores dispositivos verificados, con garantía y listos para tu
                negocio.
              </p>
              <button className="bg-white text-slate-900 px-6 py-3 rounded-full font-bold hover:bg-primary-50 transition-colors flex items-center gap-2">
                Ver Catálogo Completo <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        <div className="flex items-end justify-between mb-8">
          <h3 className="text-2xl font-bold text-slate-800">
            {selectedBrand === 'Todos' ? 'Dispositivos Destacados' : `Modelos ${selectedBrand}`}
          </h3>
          <span className="text-sm text-slate-500">{filteredPhones.length} resultados</span>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            <AnimatePresence>
              {filteredPhones.map((phone) => (
                <PhoneCard
                  key={phone.id}
                  phone={phone}
                  isClientView={true} // Clean view
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {filteredPhones.length === 0 && !isLoading && (
          <div className="text-center py-20">
            <Monitor className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No se encontraron equipos</h3>
            <p className="text-slate-500">Intenta con otra búsqueda o categoría.</p>
          </div>
        )}
      </main>

      <FloatingCart reservedPhones={[]} sessionId="demo" timeLeft={0} />
      {/* <CartDrawer /> */}
    </div>
  );
}
