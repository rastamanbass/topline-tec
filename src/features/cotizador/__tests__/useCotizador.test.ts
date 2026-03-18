import { describe, it, expect, beforeEach } from 'vitest';

interface CartItem {
  phoneId: string;
  imei: string;
  marca: string;
  modelo: string;
  storage?: string;
  precio: number;
  addedAt: number;
}
interface RemovedItem extends CartItem {
  removedAt: number;
  removedBy: string;
}

function createCart() {
  let items: CartItem[] = [];
  let removed: RemovedItem[] = [];
  return {
    getItems: () => items,
    getRemoved: () => removed,
    getTotal: () => items.reduce((sum, i) => sum + i.precio, 0),
    getCount: () => items.length,
    addItem: (item: CartItem) => {
      if (items.some((i) => i.imei === item.imei)) return false;
      items = [item, ...items];
      return true;
    },
    removeItem: (imei: string, removedBy: string) => {
      const item = items.find((i) => i.imei === imei);
      if (!item) return false;
      items = items.filter((i) => i.imei !== imei);
      removed = [{ ...item, removedAt: Date.now(), removedBy }, ...removed];
      return true;
    },
    clear: () => {
      items = [];
      removed = [];
    },
  };
}

describe('Cotizador cart logic', () => {
  let cart: ReturnType<typeof createCart>;
  beforeEach(() => {
    cart = createCart();
  });

  it('adds phone to cart', () => {
    expect(
      cart.addItem({
        phoneId: 'p1',
        imei: '356371101234567',
        marca: 'Apple',
        modelo: 'iPhone 15 Pro Max',
        storage: '256GB',
        precio: 850,
        addedAt: Date.now(),
      })
    ).toBe(true);
    expect(cart.getCount()).toBe(1);
    expect(cart.getTotal()).toBe(850);
  });
  it('rejects duplicate IMEI', () => {
    const item = {
      phoneId: 'p1',
      imei: '356371101234567',
      marca: 'Apple',
      modelo: 'iPhone 15',
      storage: '128GB',
      precio: 500,
      addedAt: Date.now(),
    };
    cart.addItem(item);
    expect(cart.addItem(item)).toBe(false);
    expect(cart.getCount()).toBe(1);
  });
  it('removes phone and tracks in audit log', () => {
    cart.addItem({
      phoneId: 'p1',
      imei: '356371101234567',
      marca: 'Apple',
      modelo: 'iPhone 15',
      storage: '128GB',
      precio: 500,
      addedAt: Date.now(),
    });
    expect(cart.removeItem('356371101234567', 'admin@topline.com')).toBe(true);
    expect(cart.getCount()).toBe(0);
    expect(cart.getRemoved()).toHaveLength(1);
    expect(cart.getRemoved()[0].removedBy).toBe('admin@topline.com');
  });
  it('calculates total correctly', () => {
    cart.addItem({
      phoneId: 'p1',
      imei: '111',
      marca: 'Apple',
      modelo: 'A',
      precio: 500,
      addedAt: 1,
    });
    cart.addItem({
      phoneId: 'p2',
      imei: '222',
      marca: 'Samsung',
      modelo: 'B',
      precio: 300,
      addedAt: 2,
    });
    cart.addItem({
      phoneId: 'p3',
      imei: '333',
      marca: 'Apple',
      modelo: 'C',
      precio: 750,
      addedAt: 3,
    });
    expect(cart.getTotal()).toBe(1550);
  });
  it('clear resets everything', () => {
    cart.addItem({
      phoneId: 'p1',
      imei: '111',
      marca: 'Apple',
      modelo: 'A',
      precio: 500,
      addedAt: 1,
    });
    cart.removeItem('111', 'user');
    cart.clear();
    expect(cart.getCount()).toBe(0);
    expect(cart.getRemoved()).toHaveLength(0);
  });
});
