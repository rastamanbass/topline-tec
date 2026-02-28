export interface DeviceModel {
  brand: string;
  model: string;
  type: 'smartphone' | 'tablet' | 'smartwatch';
}

export const deviceCatalog: DeviceModel[] = [
  // --- APPLE ---
  // iPhones
  { brand: 'Apple', model: 'iPhone 17 Pro Max', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 17 Pro', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 17 Plus', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 17', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 16 Pro Max', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 16 Pro', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 16 Plus', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 16', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 15 Pro Max', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 15 Pro', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 15 Plus', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 15', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 14 Pro Max', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 14 Pro', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 14 Plus', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 14', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 13 Pro Max', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 13 Pro', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 13', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 13 mini', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 12 Pro Max', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 12', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 11 Pro Max', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone 11', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone XR', type: 'smartphone' },
  { brand: 'Apple', model: 'iPhone X', type: 'smartphone' },
  // iPads
  { brand: 'Apple', model: 'iPad Pro 12.9 (M2)', type: 'tablet' },
  { brand: 'Apple', model: 'iPad Pro 11 (M2)', type: 'tablet' },
  { brand: 'Apple', model: 'iPad Air (5th gen)', type: 'tablet' },
  { brand: 'Apple', model: 'iPad (10th gen)', type: 'tablet' },
  { brand: 'Apple', model: 'iPad mini (6th gen)', type: 'tablet' },
  // Watches
  { brand: 'Apple', model: 'Apple Watch Ultra 2', type: 'smartwatch' },
  { brand: 'Apple', model: 'Apple Watch Series 9', type: 'smartwatch' },
  { brand: 'Apple', model: 'Apple Watch SE', type: 'smartwatch' },

  // --- SAMSUNG ---
  // S Series
  { brand: 'Samsung', model: 'Galaxy S26 Ultra', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy S26+', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy S26', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy S25 Ultra', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy S25+', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy S25', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy S24 Ultra', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy S24+', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy S24', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy S23 Ultra', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy S23', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy S22 Ultra', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy S21 Ultra', type: 'smartphone' },
  // Z Series
  { brand: 'Samsung', model: 'Galaxy Z Fold5', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy Z Flip5', type: 'smartphone' },
  // A Series
  { brand: 'Samsung', model: 'Galaxy A54 5G', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy A34 5G', type: 'smartphone' },
  { brand: 'Samsung', model: 'Galaxy A14', type: 'smartphone' },
  // Tablets
  { brand: 'Samsung', model: 'Galaxy Tab S9 Ultra', type: 'tablet' },
  { brand: 'Samsung', model: 'Galaxy Tab S9', type: 'tablet' },
  // Watches
  { brand: 'Samsung', model: 'Galaxy Watch6 Classic', type: 'smartwatch' },
  { brand: 'Samsung', model: 'Galaxy Watch6', type: 'smartwatch' },

  // --- XIAOMI ---
  { brand: 'Xiaomi', model: 'Redmi Note 13 Pro+', type: 'smartphone' },
  { brand: 'Xiaomi', model: 'Redmi Note 13', type: 'smartphone' },
  { brand: 'Xiaomi', model: 'Redmi Note 12', type: 'smartphone' },
  { brand: 'Xiaomi', model: 'Redmi 12C', type: 'smartphone' },
  { brand: 'Xiaomi', model: '13T Pro', type: 'smartphone' },
  { brand: 'Xiaomi', model: 'POCO X6 Pro', type: 'smartphone' },
  { brand: 'Xiaomi', model: 'POCO F5', type: 'smartphone' },

  // --- OTHERS ---
  { brand: 'Google', model: 'Pixel 8 Pro', type: 'smartphone' },
  { brand: 'Google', model: 'Pixel 8', type: 'smartphone' },
  { brand: 'Google', model: 'Pixel 7a', type: 'smartphone' },
  { brand: 'Motorola', model: 'Moto G84', type: 'smartphone' },
  { brand: 'Honor', model: 'Magic6 Pro', type: 'smartphone' },
  { brand: 'Honor', model: 'X8b', type: 'smartphone' },
];
