import { create } from 'zustand';
import type { PurchaseItem, Client } from '../../../types';

interface SalesStore {
  // Cart
  cartItems: PurchaseItem[];
  addToCart: (item: PurchaseItem) => void;
  addBulkToCart: (items: PurchaseItem[]) => void;
  removeFromCart: (index: number) => void;
  updateCartItemPrice: (index: number, newPrice: number, reason: string, approvedBy?: string) => void;
  clearCart: () => void;

  // Checkout State
  isPaymentModalOpen: boolean;
  selectedClient: Client | null;
  paymentMethod: string;
  discount: number;
  amountPaidWithCredit: number;
  amountPaidWithWorkshopDebt: number;
  transferDetails: {
    number: string;
    name: string;
    bank: string;
  };
  notes: string;

  // Actions
  openPaymentModal: () => void;
  closePaymentModal: () => void;
  setSelectedClient: (client: Client | null) => void;
  setPaymentMethod: (method: string) => void;
  setDiscount: (amount: number) => void;
  setAmountPaidWithCredit: (amount: number) => void;
  setAmountPaidWithWorkshopDebt: (amount: number) => void;
  setTransferDetails: (details: Partial<SalesStore['transferDetails']>) => void;
  setNotes: (notes: string) => void;
  resetCheckout: () => void;
}

export const useSalesStore = create<SalesStore>((set) => ({
  cartItems: [],
  addToCart: (item) => set((state) => ({ cartItems: [...state.cartItems, item] })),
  addBulkToCart: (items) => set((state) => ({ cartItems: [...state.cartItems, ...items] })),
  removeFromCart: (index) =>
    set((state) => ({
      cartItems: state.cartItems.filter((_, i) => i !== index),
    })),
  updateCartItemPrice: (index, newPrice, reason, approvedBy) =>
    set((state) => ({
      cartItems: state.cartItems.map((item, i) =>
        i === index
          ? {
              ...item,
              originalPrice: item.originalPrice ?? item.price,
              price: newPrice,
              discountReason: reason,
              discountApprovedBy: approvedBy || 'unknown',
            }
          : item
      ),
    })),
  clearCart: () => set({ cartItems: [] }),

  // Checkout State Initial Values
  isPaymentModalOpen: false,
  selectedClient: null,
  paymentMethod: 'Efectivo',
  discount: 0,
  amountPaidWithCredit: 0,
  amountPaidWithWorkshopDebt: 0,
  transferDetails: { number: '', name: '', bank: '' },
  notes: '',

  // Actions
  openPaymentModal: () => set({ isPaymentModalOpen: true }),
  closePaymentModal: () => set({ isPaymentModalOpen: false }),
  setSelectedClient: (client) => set({ selectedClient: client }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setDiscount: (amount) => set({ discount: amount }),
  setAmountPaidWithCredit: (amount) => set({ amountPaidWithCredit: amount }),
  setAmountPaidWithWorkshopDebt: (amount) => set({ amountPaidWithWorkshopDebt: amount }),
  setTransferDetails: (details) =>
    set((state) => ({
      transferDetails: { ...state.transferDetails, ...details },
    })),
  setNotes: (notes) => set({ notes }),
  resetCheckout: () =>
    set({
      isPaymentModalOpen: false,
      selectedClient: null,
      paymentMethod: 'Efectivo',
      discount: 0,
      amountPaidWithCredit: 0,
      amountPaidWithWorkshopDebt: 0,
      transferDetails: { number: '', name: '', bank: '' },
      notes: '',
      cartItems: [], // Usually reset this? Depends if we want to clear cart after sale
    }),
}));
