import { create } from 'zustand';

export interface CartItem {
  phoneId: string;
  imei: string;
  marca: string;
  modelo: string;
  storage?: string;
  precio: number;
  addedAt: number;
}
export interface RemovedItem extends CartItem {
  removedAt: number;
  removedBy: string;
}

interface CotizadorState {
  items: CartItem[];
  removed: RemovedItem[];
  addItem: (item: CartItem) => boolean;
  removeItem: (imei: string, removedBy: string) => boolean;
  clear: () => void;
  getTotal: () => number;
}

export const useCotizador = create<CotizadorState>((set, get) => ({
  items: [],
  removed: [],
  addItem: (item) => {
    if (get().items.some((i) => i.imei === item.imei)) return false;
    set({ items: [item, ...get().items] });
    return true;
  },
  removeItem: (imei, removedBy) => {
    const item = get().items.find((i) => i.imei === imei);
    if (!item) return false;
    set({
      items: get().items.filter((i) => i.imei !== imei),
      removed: [{ ...item, removedAt: Date.now(), removedBy }, ...get().removed],
    });
    return true;
  },
  clear: () => set({ items: [], removed: [] }),
  getTotal: () => get().items.reduce((sum, i) => sum + i.precio, 0),
}));
