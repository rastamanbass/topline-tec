import { describe, it, expect, beforeEach } from 'vitest';
import { useInventoryStore } from '../inventoryStore';

describe('Inventory Logic (Store)', () => {
  beforeEach(() => {
    useInventoryStore.setState({
      searchQuery: '',
      selectedPhoneIds: new Set(),
      isModalOpen: false,
      selectedLot: null,
      selectedStatus: null,
      viewMode: 'catalog',
      clientViewMode: false,
      modalMode: 'create',
      selectedPhone: null,
      initialBatch: null,
    });
  });

  it('should initialize with default state', () => {
    const state = useInventoryStore.getState();
    expect(state.searchQuery).toBe('');
    expect(state.selectedLot).toBeNull();
    expect(state.selectedStatus).toBeNull();
    expect(state.viewMode).toBe('catalog');
    expect(state.clientViewMode).toBe(false);
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

  // ── NEW TESTS ─────────────────────────────────────────────────────────────

  describe('clearFilters', () => {
    it('resets searchQuery, selectedLot, and selectedStatus', () => {
      const store = useInventoryStore.getState();

      // Set some filters first
      store.setSearchQuery('iPhone 15');
      store.setSelectedLot('Lote-2026-03');
      store.setSelectedStatus('En Stock (Disponible para Venta)');

      // Verify filters are set
      let state = useInventoryStore.getState();
      expect(state.searchQuery).toBe('iPhone 15');
      expect(state.selectedLot).toBe('Lote-2026-03');
      expect(state.selectedStatus).toBe('En Stock (Disponible para Venta)');

      // Clear
      useInventoryStore.getState().clearFilters();

      state = useInventoryStore.getState();
      expect(state.searchQuery).toBe('');
      expect(state.selectedLot).toBeNull();
      expect(state.selectedStatus).toBeNull();
    });

    it('does not affect selection or modal state', () => {
      const store = useInventoryStore.getState();

      // Set selection and modal
      store.toggleSelection('phone-abc');
      store.openModal('edit');
      store.setSearchQuery('test');

      // Clear filters
      useInventoryStore.getState().clearFilters();

      const state = useInventoryStore.getState();
      // Filters cleared
      expect(state.searchQuery).toBe('');
      // Selection and modal NOT affected
      expect(state.selectedPhoneIds.has('phone-abc')).toBe(true);
      expect(state.isModalOpen).toBe(true);
      expect(state.modalMode).toBe('edit');
    });
  });

  describe('selectAll / deselectMany batch operations', () => {
    it('selectAll replaces current selection with provided IDs', () => {
      const store = useInventoryStore.getState();

      // Pre-select something
      store.toggleSelection('old-phone');
      expect(useInventoryStore.getState().selectedPhoneIds.has('old-phone')).toBe(true);

      // Select all with new set
      useInventoryStore.getState().selectAll(['p1', 'p2', 'p3']);

      const state = useInventoryStore.getState();
      expect(state.selectedPhoneIds.size).toBe(3);
      expect(state.selectedPhoneIds.has('p1')).toBe(true);
      expect(state.selectedPhoneIds.has('p2')).toBe(true);
      expect(state.selectedPhoneIds.has('p3')).toBe(true);
      // Old selection replaced
      expect(state.selectedPhoneIds.has('old-phone')).toBe(false);
    });

    it('selectAll with empty array clears selection', () => {
      const store = useInventoryStore.getState();
      store.toggleSelection('phone-1');

      useInventoryStore.getState().selectAll([]);
      expect(useInventoryStore.getState().selectedPhoneIds.size).toBe(0);
    });

    it('deselectMany removes specific IDs from selection', () => {
      const store = useInventoryStore.getState();
      store.selectAll(['p1', 'p2', 'p3', 'p4', 'p5']);

      useInventoryStore.getState().deselectMany(['p2', 'p4']);

      const state = useInventoryStore.getState();
      expect(state.selectedPhoneIds.size).toBe(3);
      expect(state.selectedPhoneIds.has('p1')).toBe(true);
      expect(state.selectedPhoneIds.has('p2')).toBe(false);
      expect(state.selectedPhoneIds.has('p3')).toBe(true);
      expect(state.selectedPhoneIds.has('p4')).toBe(false);
      expect(state.selectedPhoneIds.has('p5')).toBe(true);
    });

    it('deselectMany ignores IDs not in selection', () => {
      const store = useInventoryStore.getState();
      store.selectAll(['p1', 'p2']);

      useInventoryStore.getState().deselectMany(['p99', 'p100']);

      const state = useInventoryStore.getState();
      expect(state.selectedPhoneIds.size).toBe(2);
    });

    it('clearSelection empties the set', () => {
      const store = useInventoryStore.getState();
      store.selectAll(['a', 'b', 'c']);

      useInventoryStore.getState().clearSelection();
      expect(useInventoryStore.getState().selectedPhoneIds.size).toBe(0);
    });
  });

  describe('viewMode toggle', () => {
    it('defaults to catalog view', () => {
      expect(useInventoryStore.getState().viewMode).toBe('catalog');
    });

    it('switches to list view', () => {
      useInventoryStore.getState().setViewMode('list');
      expect(useInventoryStore.getState().viewMode).toBe('list');
    });

    it('switches back to catalog view', () => {
      useInventoryStore.getState().setViewMode('list');
      useInventoryStore.getState().setViewMode('catalog');
      expect(useInventoryStore.getState().viewMode).toBe('catalog');
    });
  });

  describe('clientViewMode', () => {
    it('defaults to false', () => {
      expect(useInventoryStore.getState().clientViewMode).toBe(false);
    });

    it('can be enabled', () => {
      useInventoryStore.getState().setClientViewMode(true);
      expect(useInventoryStore.getState().clientViewMode).toBe(true);
    });
  });

  describe('openModal with phone and initialBatch', () => {
    it('opens in edit mode with a selected phone', () => {
      const mockPhone = {
        id: 'p1',
        imei: '356371101234567',
        marca: 'Apple',
        modelo: 'iPhone 15 Pro Max',
        lote: 'Lote-1',
        costo: 500,
        precioVenta: 800,
        estado: 'En Stock (Disponible para Venta)' as const,
        fechaIngreso: new Date(),
      };

      useInventoryStore.getState().openModal('edit', mockPhone);

      const state = useInventoryStore.getState();
      expect(state.isModalOpen).toBe(true);
      expect(state.modalMode).toBe('edit');
      expect(state.selectedPhone?.id).toBe('p1');
    });

    it('opens in create mode with initialBatch', () => {
      useInventoryStore.getState().openModal('create', undefined, 'Lote-2026-03');

      const state = useInventoryStore.getState();
      expect(state.isModalOpen).toBe(true);
      expect(state.modalMode).toBe('create');
      expect(state.selectedPhone).toBeNull();
      expect(state.initialBatch).toBe('Lote-2026-03');
    });

    it('closeModal clears selectedPhone but not initialBatch directly', () => {
      useInventoryStore.getState().openModal('view');
      useInventoryStore.getState().closeModal();

      const state = useInventoryStore.getState();
      expect(state.isModalOpen).toBe(false);
      expect(state.selectedPhone).toBeNull();
    });
  });
});
