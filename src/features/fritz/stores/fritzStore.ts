import { create } from 'zustand';
import type { FritzMessage, SalePreview } from '../types';

interface FritzStore {
  isOpen: boolean;
  messages: FritzMessage[];
  isLoading: boolean;
  salePreview: SalePreview | null;
  conversationId: string | null;
  notificationCount: number;

  togglePanel: () => void;
  setOpen: (open: boolean) => void;
  addMessage: (msg: FritzMessage) => void;
  updateMessage: (id: string, updates: Partial<FritzMessage>) => void;
  setLoading: (v: boolean) => void;
  setSalePreview: (preview: SalePreview | null) => void;
  setConversationId: (id: string) => void;
  clearMessages: () => void;
  setNotificationCount: (n: number) => void;
}

export const useFritzStore = create<FritzStore>((set) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  salePreview: null,
  conversationId: null,
  notificationCount: 0,

  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  setLoading: (v) => set({ isLoading: v }),
  setSalePreview: (preview) => set({ salePreview: preview }),
  setConversationId: (id) => set({ conversationId: id }),
  clearMessages: () => set({ messages: [] }),
  setNotificationCount: (n) => set({ notificationCount: n }),
}));
