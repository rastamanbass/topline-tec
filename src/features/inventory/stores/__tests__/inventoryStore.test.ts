import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useInventoryStore } from '../inventoryStore';

// Mock Dependencies
vi.mock('../services/deviceService', () => ({
  fetchPhones: vi.fn(),
  deletePhone: vi.fn(),
}));

describe('Inventory Logic (Store)', () => {
  beforeEach(() => {
    useInventoryStore.setState({
      searchQuery: '',
      selectedPhoneIds: new Set(),
      isModalOpen: false,
    });
  });

  it('should initialize with default state', () => {
    const state = useInventoryStore.getState();
    expect(state.searchQuery).toBe('');
    expect(state.selectedLot).toBeNull();
  });

  it('should select and deselect phones correctly', () => {
    const state = useInventoryStore.getState();
    // Select one
    state.toggleSelection('phone-123');
    expect(useInventoryStore.getState().selectedPhoneIds.has('phone-123')).toBe(true);

    // Select another
    state.toggleSelection('phone-456');
    expect(useInventoryStore.getState().selectedPhoneIds.size).toBe(2);

    // Deselect
    state.toggleSelection('phone-123');
    expect(useInventoryStore.getState().selectedPhoneIds.has('phone-123')).toBe(false);
    expect(useInventoryStore.getState().selectedPhoneIds.has('phone-456')).toBe(true);
  });

  it('should handle modal state correctly', () => {
    const { openModal, closeModal } = useInventoryStore.getState();

    openModal('create');
    let state = useInventoryStore.getState();
    expect(state.isModalOpen).toBe(true);
    expect(state.modalMode).toBe('create');

    closeModal();
    state = useInventoryStore.getState();
    expect(state.isModalOpen).toBe(false);
    expect(state.selectedPhone).toBeNull();
  });
});
