import { useLocation } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { useAuth } from '../../../context';
import { useFritzStore } from '../stores/fritzStore';

const HIDDEN_ON = ['/login', '/catalogo'];

export function FritzBubble() {
  const location = useLocation();
  const { user, userRole } = useAuth();
  const { togglePanel, notificationCount, isOpen } = useFritzStore();

  // Hide on public pages, when not logged in, or for compradores
  if (!user || userRole === 'comprador') return null;
  if (HIDDEN_ON.some((p) => location.pathname.startsWith(p))) return null;
  // Hide bubble when panel is open (panel has its own close button)
  if (isOpen) return null;

  return (
    <button
      onClick={togglePanel}
      className="fixed bottom-20 right-4 z-[60] w-14 h-14 rounded-full shadow-lg
        bg-gradient-to-br from-blue-500 to-purple-600 text-white
        flex items-center justify-center
        hover:scale-110 active:scale-95 transition-transform duration-200
        animate-in zoom-in-0 duration-300"
      aria-label="Abrir Fritz"
    >
      <Bot className="w-7 h-7" />

      {/* Notification badge */}
      {notificationCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full
          text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
          {notificationCount > 9 ? '9+' : notificationCount}
        </span>
      )}
    </button>
  );
}
