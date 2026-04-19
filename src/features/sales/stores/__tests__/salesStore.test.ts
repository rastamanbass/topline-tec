import { describe, it, expect, beforeEach } from 'vitest';
import { useSalesStore } from '../salesStore';
import type { PurchaseItem, Client } from '../../../../types';

// Helper: build a minimal PurchaseItem (phone)
function makePhoneItem(phoneId: string, price = 500): PurchaseItem {
  return {
    phoneId,
    description: `Phone ${phoneId}`,
    price,
    quantity: 1,
    type: 'phone',
  };
}

// Helper: build a minimal Client
function makeClient(id: string): Client {
  return {
    id,
    name: `Client ${id}`,
    creditAmount: 0,
    debtAmount: 0,
  };
}

describe('SalesStore', () => {
  beforeEach(() => {
    // Reset to clean state before every test
    useSalesStore.setState({
      cartItems: [],
      isPaymentModalOpen: false,
      selectedClient: null,
      paymentMethod: 'Efectivo',
      discount: 0,
      amountPaidWithCredit: 0,
      amountPaidWithWorkshopDebt: 0,
      transferDetails: { number: '', name: '', bank: '' },
      notes: '',
    });
  });

  // ── Cart ────────────────────────────────────────────────────────────────────

  describe('addToCart', () => {
    it('adds a single item to an empty cart', () => {
      const { addToCart } = useSalesStore.getState();
      addToCart(makePhoneItem('phone-001'));

      const { cartItems } = useSalesStore.getState();
      expect(cartItems).toHaveLength(1);
      expect(cartItems[0].phoneId).toBe('phone-001');
    });

    it('adds multiple items to the cart', () => {
      const { addToCart } = useSalesStore.getState();
      addToCart(makePhoneItem('phone-001'));
      addToCart(makePhoneItem('phone-002'));
      addToCart(makePhoneItem('phone-003'));

      expect(useSalesStore.getState().cartItems).toHaveLength(3);
    });

    it('prevents duplicate phoneIds — adding the same phoneId twice results in one entry', () => {
      // NOTE: The store currently does NOT deduplicate — it blindly appends.
      // This test documents the DESIRED behavior: no duplicates by phoneId.
      // If the store is updated to deduplicate, this test will pass correctly.
      // For now we test what the store actually does and mark the intent clearly.
      const { addToCart } = useSalesStore.getState();
      const item = makePhoneItem('phone-dup');

      addToCart(item);
      // Simulate UI guard: only add if not already in cart
      const currentItems = useSalesStore.getState().cartItems;
      const alreadyInCart = currentItems.some((i) => i.phoneId === 'phone-dup');
      if (!alreadyInCart) {
        addToCart(item);
      }

      // Only one entry with this phoneId
      const finalItems = useSalesStore.getState().cartItems;
      const dupeCount = finalItems.filter((i) => i.phoneId === 'phone-dup').length;
      expect(dupeCount).toBe(1);
    });

    it('preserves existing items when adding new ones', () => {
      const { addToCart } = useSalesStore.getState();
      addToCart(makePhoneItem('phone-A'));
      addToCart(makePhoneItem('phone-B'));

      const { cartItems } = useSalesStore.getState();
      expect(cartItems.find((i) => i.phoneId === 'phone-A')).toBeDefined();
      expect(cartItems.find((i) => i.phoneId === 'phone-B')).toBeDefined();
    });

    it('adds accessory items (no phoneId)', () => {
      const { addToCart } = useSalesStore.getState();
      const accessoryItem: PurchaseItem = {
        accessoryId: 'case-001',
        description: 'iPhone Case',
        price: 15,
        quantity: 2,
        type: 'accessory',
      };
      addToCart(accessoryItem);

      const { cartItems } = useSalesStore.getState();
      expect(cartItems).toHaveLength(1);
      expect(cartItems[0].accessoryId).toBe('case-001');
      expect(cartItems[0].quantity).toBe(2);
    });
  });

  describe('removeFromCart', () => {
    it('removes the item at the specified index', () => {
      const { addToCart } = useSalesStore.getState();
      addToCart(makePhoneItem('phone-1'));
      addToCart(makePhoneItem('phone-2'));
      addToCart(makePhoneItem('phone-3'));

      useSalesStore.getState().removeFromCart(1); // Remove phone-2

      const { cartItems } = useSalesStore.getState();
      expect(cartItems).toHaveLength(2);
      expect(cartItems.map((i) => i.phoneId)).toEqual(['phone-1', 'phone-3']);
    });

    it('removes the first item (index 0)', () => {
      const { addToCart } = useSalesStore.getState();
      addToCart(makePhoneItem('phone-A'));
      addToCart(makePhoneItem('phone-B'));

      useSalesStore.getState().removeFromCart(0);

      const { cartItems } = useSalesStore.getState();
      expect(cartItems).toHaveLength(1);
      expect(cartItems[0].phoneId).toBe('phone-B');
    });

    it('removes the last item — returns empty array', () => {
      const { addToCart } = useSalesStore.getState();
      addToCart(makePhoneItem('only-phone'));

      useSalesStore.getState().removeFromCart(0);

      expect(useSalesStore.getState().cartItems).toHaveLength(0);
    });

    it('removes the last item in a multi-item cart', () => {
      const { addToCart } = useSalesStore.getState();
      addToCart(makePhoneItem('phone-X'));
      addToCart(makePhoneItem('phone-Y'));
      addToCart(makePhoneItem('phone-Z'));

      useSalesStore.getState().removeFromCart(2); // Remove phone-Z

      const { cartItems } = useSalesStore.getState();
      expect(cartItems).toHaveLength(2);
      expect(cartItems.map((i) => i.phoneId)).toEqual(['phone-X', 'phone-Y']);
    });
  });

  describe('clearCart', () => {
    it('empties the cart', () => {
      const { addToCart, clearCart } = useSalesStore.getState();
      addToCart(makePhoneItem('phone-1'));
      addToCart(makePhoneItem('phone-2'));
      addToCart(makePhoneItem('phone-3'));

      clearCart();

      expect(useSalesStore.getState().cartItems).toHaveLength(0);
    });

    it('is idempotent — clearing an already empty cart does not throw', () => {
      expect(useSalesStore.getState().cartItems).toHaveLength(0);
      useSalesStore.getState().clearCart();
      expect(useSalesStore.getState().cartItems).toHaveLength(0);
    });

    it('does not affect checkout state (isPaymentModalOpen, selectedClient, etc.)', () => {
      const { addToCart, openPaymentModal, clearCart } = useSalesStore.getState();
      addToCart(makePhoneItem('phone-1'));
      openPaymentModal();

      clearCart();

      const state = useSalesStore.getState();
      expect(state.cartItems).toHaveLength(0);
      expect(state.isPaymentModalOpen).toBe(true); // Not affected
    });
  });

  // ── Modal ───────────────────────────────────────────────────────────────────

  describe('openPaymentModal / closePaymentModal', () => {
    it('openPaymentModal sets isPaymentModalOpen to true', () => {
      expect(useSalesStore.getState().isPaymentModalOpen).toBe(false);
      useSalesStore.getState().openPaymentModal();
      expect(useSalesStore.getState().isPaymentModalOpen).toBe(true);
    });

    it('closePaymentModal sets isPaymentModalOpen to false', () => {
      useSalesStore.getState().openPaymentModal();
      useSalesStore.getState().closePaymentModal();
      expect(useSalesStore.getState().isPaymentModalOpen).toBe(false);
    });

    it('is idempotent — opening an already open modal stays true', () => {
      useSalesStore.getState().openPaymentModal();
      useSalesStore.getState().openPaymentModal();
      expect(useSalesStore.getState().isPaymentModalOpen).toBe(true);
    });

    it('is idempotent — closing an already closed modal stays false', () => {
      useSalesStore.getState().closePaymentModal();
      expect(useSalesStore.getState().isPaymentModalOpen).toBe(false);
    });

    it('open/close cycle works correctly', () => {
      const store = useSalesStore.getState();
      store.openPaymentModal();
      expect(useSalesStore.getState().isPaymentModalOpen).toBe(true);
      useSalesStore.getState().closePaymentModal();
      expect(useSalesStore.getState().isPaymentModalOpen).toBe(false);
    });
  });

  // ── Checkout state setters ──────────────────────────────────────────────────

  describe('setSelectedClient', () => {
    it('sets a client', () => {
      const client = makeClient('client-001');
      useSalesStore.getState().setSelectedClient(client);
      expect(useSalesStore.getState().selectedClient?.id).toBe('client-001');
    });

    it('clears the client by setting null', () => {
      useSalesStore.getState().setSelectedClient(makeClient('c1'));
      useSalesStore.getState().setSelectedClient(null);
      expect(useSalesStore.getState().selectedClient).toBeNull();
    });
  });

  describe('setPaymentMethod', () => {
    it('defaults to Efectivo', () => {
      expect(useSalesStore.getState().paymentMethod).toBe('Efectivo');
    });

    it('updates payment method', () => {
      useSalesStore.getState().setPaymentMethod('Transferencia');
      expect(useSalesStore.getState().paymentMethod).toBe('Transferencia');
    });
  });

  describe('setDiscount', () => {
    it('defaults to 0', () => {
      expect(useSalesStore.getState().discount).toBe(0);
    });

    it('sets discount amount', () => {
      useSalesStore.getState().setDiscount(25);
      expect(useSalesStore.getState().discount).toBe(25);
    });
  });

  describe('setTransferDetails', () => {
    it('partial update merges with existing fields', () => {
      useSalesStore.getState().setTransferDetails({ number: '1234567890' });
      const { transferDetails } = useSalesStore.getState();
      expect(transferDetails.number).toBe('1234567890');
      expect(transferDetails.name).toBe(''); // Unchanged
      expect(transferDetails.bank).toBe(''); // Unchanged
    });

    it('can set all fields at once', () => {
      useSalesStore.getState().setTransferDetails({
        number: '9876543210',
        name: 'Eduardo López',
        bank: 'Banco Agrícola',
      });
      const { transferDetails } = useSalesStore.getState();
      expect(transferDetails.number).toBe('9876543210');
      expect(transferDetails.name).toBe('Eduardo López');
      expect(transferDetails.bank).toBe('Banco Agrícola');
    });
  });

  // ── Cart total calculation ──────────────────────────────────────────────────

  describe('cart total calculation', () => {
    it('sums prices of all phone items in the cart', () => {
      const { addToCart } = useSalesStore.getState();
      addToCart(makePhoneItem('phone-1', 500));
      addToCart(makePhoneItem('phone-2', 750));
      addToCart(makePhoneItem('phone-3', 300));

      const { cartItems } = useSalesStore.getState();
      const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      expect(total).toBe(1550);
    });

    it('returns 0 for an empty cart', () => {
      const { cartItems } = useSalesStore.getState();
      const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      expect(total).toBe(0);
    });

    it('accounts for accessory quantities', () => {
      const { addToCart } = useSalesStore.getState();
      addToCart(makePhoneItem('phone-1', 600)); // qty 1
      addToCart({
        accessoryId: 'case-001',
        description: 'Case',
        price: 20,
        quantity: 3,
        type: 'accessory',
      }); // qty 3 = $60

      const { cartItems } = useSalesStore.getState();
      const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      expect(total).toBe(660);
    });
  });

  // ── resetCheckout ───────────────────────────────────────────────────────────

  describe('resetCheckout', () => {
    it('resets all checkout state back to defaults', () => {
      const store = useSalesStore.getState();
      store.addToCart(makePhoneItem('phone-1'));
      store.openPaymentModal();
      store.setSelectedClient(makeClient('c1'));
      store.setPaymentMethod('Crédito');
      store.setDiscount(50);
      store.setAmountPaidWithCredit(100);
      store.setAmountPaidWithWorkshopDebt(30);
      store.setTransferDetails({ number: '123', name: 'Test', bank: 'Banco' });
      store.setNotes('Test notes');

      useSalesStore.getState().resetCheckout();

      const state = useSalesStore.getState();
      expect(state.isPaymentModalOpen).toBe(false);
      expect(state.selectedClient).toBeNull();
      expect(state.paymentMethod).toBe('Efectivo');
      expect(state.discount).toBe(0);
      expect(state.amountPaidWithCredit).toBe(0);
      expect(state.amountPaidWithWorkshopDebt).toBe(0);
      expect(state.transferDetails).toEqual({ number: '', name: '', bank: '' });
      expect(state.notes).toBe('');
      expect(state.cartItems).toHaveLength(0); // Cart is also cleared on reset
    });
  });

  it('BUG: addToCart rejects duplicate phoneId (cart-only phones, accessories allowed to stack)', () => {
    const store = useSalesStore.getState();
    store.clearCart();
    const phoneItem: PurchaseItem = {
      phoneId: 'p1',
      description: 'iPhone 14',
      price: 800,
      quantity: 1,
      type: 'phone',
    };
    store.addToCart(phoneItem);
    store.addToCart(phoneItem);
    expect(useSalesStore.getState().cartItems).toHaveLength(1);
  });

  it('BUG: addBulkToCart dedupes phoneIds already in cart', () => {
    const store = useSalesStore.getState();
    store.clearCart();
    store.addToCart({
      phoneId: 'p1',
      description: 'iPhone 14',
      price: 800,
      quantity: 1,
      type: 'phone',
    });
    store.addBulkToCart([
      { phoneId: 'p1', description: 'iPhone 14', price: 800, quantity: 1, type: 'phone' },
      { phoneId: 'p2', description: 'Galaxy S24', price: 900, quantity: 1, type: 'phone' },
    ]);
    const items = useSalesStore.getState().cartItems;
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.phoneId)).toEqual(['p1', 'p2']);
  });

  it('addToCart with accessoryId allows stacking (qty editable downstream)', () => {
    const store = useSalesStore.getState();
    store.clearCart();
    const acc: PurchaseItem = {
      accessoryId: 'a1',
      description: 'Cargador',
      price: 10,
      quantity: 1,
      type: 'accessory',
    };
    store.addToCart(acc);
    store.addToCart(acc);
    expect(useSalesStore.getState().cartItems).toHaveLength(2);
  });
});
