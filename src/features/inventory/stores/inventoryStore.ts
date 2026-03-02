import { create } from 'zustand';
import type { Phone, PhoneStatus } from '../../../types';

interface InventoryStore {
  // Filters
  searchQuery: string;
  selectedLot: string | null;
  selectedStatus: PhoneStatus | null;

  // UI State
  isModalOpen: boolean;
  modalMode: 'create' | 'edit' | 'view';
  selectedPhone: Phone | null;
  initialBatch: string | null;
  viewMode: 'list' | 'catalog';
  clientViewMode: boolean;

  // Actions - Filters
  setSearchQuery: (query: string) => void;
  setSelectedLot: (lot: string | null) => void;
  setSelectedStatus: (status: PhoneStatus | null) => void;
  setViewMode: (mode: 'list' | 'catalog') => void;
  setClientViewMode: (enabled: boolean) => void;
  clearFilters: () => void;

  // Actions - Modal
  openModal: (mode: 'create' | 'edit' | 'view', phone?: Phone, initialBatch?: string) => void;
  closeModal: () => void;

  // Bulk Selection
  selectedPhoneIds: Set<string>;
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  deselectMany: (ids: string[]) => void;
}

export const useInventoryStore = create<InventoryStore>((set) => ({
  // Initial state - Filters
  searchQuery: '',
  selectedLot: null,
  selectedStatus: null,
  viewMode: 'catalog', // Defaulting to catalog
  clientViewMode: false,

  // Initial state - UI
  isModalOpen: false,
  modalMode: 'create',
  selectedPhone: null,

  // Initial state - Selection
  selectedPhoneIds: new Set(),

  // Actions - Filters
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedLot: (lot) => set({ selectedLot: lot }),
  setSelectedStatus: (status) => set({ selectedStatus: status }),
  clearFilters: () =>
    set({
      searchQuery: '',
      selectedLot: null,
      selectedStatus: null,
    }),

  initialBatch: null,

  // Actions - Modal
  openModal: (mode: 'create' | 'edit' | 'view', phone?: Phone, initialBatch?: string) =>
    set({
      isModalOpen: true,
      modalMode: mode,
      selectedPhone: phone || null,
      initialBatch: initialBatch || null,
    }),
  closeModal: () =>
    set({
      isModalOpen: false,
      selectedPhone: null,
    }),

  // Actions - UI
  setViewMode: (mode) => set({ viewMode: mode }),
  setClientViewMode: (enabled) => set({ clientViewMode: enabled }),

  // Actions - Selection
  toggleSelection: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedPhoneIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { selectedPhoneIds: newSet };
    }),
  selectAll: (ids) => set({ selectedPhoneIds: new Set(ids) }),
  clearSelection: () => set({ selectedPhoneIds: new Set() }),
  deselectMany: (ids) =>
    set((state) => {
      const newSet = new Set(state.selectedPhoneIds);
      ids.forEach((id) => newSet.delete(id));
      return { selectedPhoneIds: newSet };
    }),
}));
