export interface MockDevice {
  id: string;
  model: string;
  modelAr: string;
  storage: string;
  color: string;
  colorAr: string;
  priceHalalat: number;
  warrantyMonths: number;
  highlights: string[];
  highlightsAr: string[];
}

export const MOCK_DEVICES: MockDevice[] = [
  {
    id: 'iphone-17-pro-256-titanium',
    model: 'iPhone 17 Pro',
    modelAr: 'آيفون 17 برو',
    storage: '256GB',
    color: 'Natural Titanium',
    colorAr: 'تيتانيوم طبيعي',
    priceHalalat: 500000,
    warrantyMonths: 12,
    highlights: ['A19 Pro chip', 'Pro camera with telephoto', '6.3" Super Retina XDR'],
    highlightsAr: ['شريحة A19 Pro', 'كاميرا برو مع تيليفوتو', 'شاشة Super Retina XDR 6.3"'],
  },
  {
    id: 'iphone-17-pro-max-512-blue',
    model: 'iPhone 17 Pro Max',
    modelAr: 'آيفون 17 برو ماكس',
    storage: '512GB',
    color: 'Deep Blue',
    colorAr: 'أزرق عميق',
    priceHalalat: 620000,
    warrantyMonths: 12,
    highlights: ['A19 Pro chip', '5x optical zoom', '6.9" display'],
    highlightsAr: ['شريحة A19 Pro', 'تكبير بصري 5x', 'شاشة 6.9"'],
  },
  {
    id: 'iphone-17-256-pink',
    model: 'iPhone 17',
    modelAr: 'آيفون 17',
    storage: '256GB',
    color: 'Pink',
    colorAr: 'وردي',
    priceHalalat: 380000,
    warrantyMonths: 12,
    highlights: ['A19 chip', 'Dual 48MP cameras', '6.1" display'],
    highlightsAr: ['شريحة A19', 'كاميرتان بدقة 48 ميجابكسل', 'شاشة 6.1"'],
  },
  {
    id: 'iphone-air-256-silver',
    model: 'iPhone Air',
    modelAr: 'آيفون إير',
    storage: '256GB',
    color: 'Silver',
    colorAr: 'فضي',
    priceHalalat: 320000,
    warrantyMonths: 12,
    highlights: ['Ultra-thin titanium', 'A19 chip', '6.6" ProMotion'],
    highlightsAr: ['تيتانيوم نحيف جداً', 'شريحة A19', 'شاشة ProMotion 6.6"'],
  },
  {
    id: 'iphone-17-128-black',
    model: 'iPhone 17',
    modelAr: 'آيفون 17',
    storage: '128GB',
    color: 'Black',
    colorAr: 'أسود',
    priceHalalat: 320000,
    warrantyMonths: 12,
    highlights: ['A19 chip', 'Dual cameras', '6.1" display'],
    highlightsAr: ['شريحة A19', 'كاميرات مزدوجة', 'شاشة 6.1"'],
  },
  {
    id: 'iphone-17-pro-1tb-titanium',
    model: 'iPhone 17 Pro',
    modelAr: 'آيفون 17 برو',
    storage: '1TB',
    color: 'Black Titanium',
    colorAr: 'تيتانيوم أسود',
    priceHalalat: 680000,
    warrantyMonths: 12,
    highlights: ['A19 Pro chip', '1TB storage', 'Pro Display XDR'],
    highlightsAr: ['شريحة A19 Pro', 'تخزين 1 تيرابايت', 'شاشة Pro XDR'],
  },
];

export function getDeviceById(id: string): MockDevice | undefined {
  return MOCK_DEVICES.find((d) => d.id === id);
}
