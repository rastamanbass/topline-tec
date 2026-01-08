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

  // Actions - Filters
  setSearchQuery: (query: string) => void;
  setSelectedLot: (lot: string | null) => void;
  setSelectedStatus: (status: PhoneStatus | null) => void;
  clearFilters: () => void;

  // Actions - Modal
  openModal: (mode: 'create' | 'edit' | 'view', phone?: Phone) => void;
  closeModal: () => void;
}

export const useInventoryStore = create<InventoryStore>((set) => ({
  // Initial state - Filters
  searchQuery: '',
  selectedLot: null,
  selectedStatus: null,

  // Initial state - UI
  isModalOpen: false,
  modalMode: 'create',
  selectedPhone: null,

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

  // Actions - Modal
  openModal: (mode, phone) =>
    set({
      isModalOpen: true,
      modalMode: mode,
      selectedPhone: phone || null,
    }),
  closeModal: () =>
    set({
      isModalOpen: false,
      selectedPhone: null,
    }),
}));
