export interface FritzMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isLoading?: boolean;
  action?: {
    type: 'sale_preview' | 'confirmation' | 'info_card';
    data: unknown;
  };
}

export interface SalePreviewItem {
  modelo: string;
  marca: string;
  storage: string;
  lote: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
  phoneIds: string[];
  imeis: string[];
}

export interface SalePreview {
  clientId: string;
  clientName: string;
  clientCredit: number;
  clientDebt: number;
  items: SalePreviewItem[];
  grandTotal: number;
  lote: string;
  availableModels: {
    modelo: string;
    marca: string;
    storage: string;
    available: number;
    price: number;
  }[];
}
