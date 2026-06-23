export interface ProjectInfo {
  otpNumber: string;
  siteName: string;
  clientName: string;
  siteAddress: string;
  conductor: string;
  subcontractor: string;
  contactName: string;
  contactPhone: string;
  showSaturdays?: boolean;
  showSundays?: boolean;
  databaseComplete?: boolean;
  databaseComment?: string;
  supplyOnly?: boolean;
  forecastedTransports?: ForecastedTransport[];
  forecastPeriodStart?: string | null;
  forecastPeriodEnd?: string | null;
}

export interface BeamElement {
  id: string;
  repere: string;
  zone: string;
  productType: string;
  section: string;
  length: number;
  weight: number;
  factory: string;
}

export interface Truck {
  id: string;
  number: string;
  date: string;
  time: string;
  elementIds: string[];
  comment?: string;
  teamId?: string;
  transporter?: string;
  handlingMeans?: Record<string, string>;
  forcedCategory?: TransportCategory;
  forcedCategoryReason?: string;
}

export const HANDLING_MEANS_OPTIONS = [
  'Chariot élévateur 25To',
  'Grue 1',
  'Grue 2',
  'Pont roulant',
] as const;

export interface Team {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
}

export interface Plan {
  id: string;
  name: string;
  zones: string[];
  productTypes: string[];
  detectedReperes: string[];
  pdfDataUrl: string;
}

export type TransportCategory = 'standard' | 'cat1' | 'cat2' | 'cat3';



export interface TransportInfo {
  category: TransportCategory;
  label: string;
  maxLength: number;
  maxWeight: number;
}

export const PRODUCT_TYPES = [
  'Poteau BA', 'Potelet BA', 'Poteau BP', 'Potelet BP',
  'Linteau BA', 'Longrine BA', 'Panneau BA',
  'Poutre BP IC', 'Poutre BP IV', 'Poutre BP R',
  'Panne BP R', 'Panne BP T', 'Prédalle', 'Dalle Alvéolaire'
] as const;

export const CONDUCTORS = [
  { name: 'Sébastien HERMENIER', phone: '06 15 98 75 26' },
  { name: 'Benjamin PRUNIER', phone: '06 60 46 05 39' },
  { name: 'Samuel BOUTIN', phone: '06 34 69 11 10' },
  { name: 'Nicola GONELLE', phone: '06 74 40 91 25' },
  { name: 'Lancelot JON', phone: '06 45 18 42 47' },
  { name: 'Jean-Philippe VIAL', phone: '06 72 83 58 45' },
] as const;

export const SUBCONTRACTORS = [
  'DUTHIL', 'JP&B CONSTRUCTION', 'LB MONTAGE', 'MD', 'MPI', 'SAUVAGEON', 'SG POSE'
] as const;

export interface ForecastedTruck {
  usine: string;
  category: TransportCategory;
  count: number;
}

export interface ForecastSlot {
  id: string;
  projectId: string;
  dateStart: string; // YYYY-MM-DD
  dateEnd: string;   // YYYY-MM-DD
  forecastedTrucks: ForecastedTruck[];
}

// New forecast model: selected ISO weeks per project
export interface ForecastWeek {
  id: string;
  projectId: string;
  year: number;
  weekNumber: number;
  teamIndex: number;
}

// Extended forecast transport categories (includes "exceptionnel")
export type ForecastTransportCategory = 'standard' | 'cat1' | 'cat2' | 'cat3';

export const FORECAST_TRANSPORT_CATEGORIES: { key: ForecastTransportCategory; label: string }[] = [
  { key: 'standard', label: 'Plateau standard' },
  { key: 'cat1', label: 'Convoi cat.1' },
  { key: 'cat2', label: 'Convoi cat.2' },
  { key: 'cat3', label: 'Convoi cat.3' },
];

export interface ForecastedTransport {
  usine: string;
  productType?: string;
  standard: number;
  cat1: number;
  cat2: number;
  cat3: number;
}

// Forecast product types (fixed dropdown values) and mapping to real product types.
export const FORECAST_PRODUCT_TYPES = [
  'Poteaux BA',
  'Poutres BP IC/IV',
  'Poutres / Poteaux BP',
  'Panneaux BA',
  'Longrines BA',
  'Pannes BP',
  'Prédalles',
  'Dalles Alvéolaires',
] as const;

export type ForecastProductType = typeof FORECAST_PRODUCT_TYPES[number];

export const PRODUCT_TYPE_MAPPING: Record<string, string[]> = {
  'Poteaux BA': ['Poteau BA', 'Potelet BA', 'Linteau BA'],
  'Poutres BP IC/IV': ['Poutre BP IC', 'Poutre BP IV'],
  'Poutres / Poteaux BP': ['Poutre BP R', 'Poteau BP', 'Potelet BP'],
  'Panneaux BA': ['Panneau BA'],
  'Longrines BA': ['Longrine BA'],
  'Pannes BP': ['Panne BP R', 'Panne BP T'],
  'Prédalles': ['Prédalle'],
  'Dalles Alvéolaires': ['Dalle Alvéolaire'],
};

export function getForecastType(realType: string): string | null {
  for (const [forecastType, realTypes] of Object.entries(PRODUCT_TYPE_MAPPING)) {
    if (realTypes.includes(realType)) return forecastType;
  }
  return null;
}

export function getRealTypes(forecastType: string): string[] {
  return PRODUCT_TYPE_MAPPING[forecastType] ?? [];
}

export const TRANSPORT_CATEGORIES: Record<TransportCategory, TransportInfo> = {
  standard: { category: 'standard', label: 'Plateau standard', maxLength: 13.5, maxWeight: 28 },
  cat1: { category: 'cat1', label: 'Convoi catégorie 1', maxLength: 16.5, maxWeight: 28 },
  cat2: { category: 'cat2', label: 'Convoi catégorie 2', maxLength: 21.5, maxWeight: 42 },
  cat3: { category: 'cat3', label: 'Convoi catégorie 3', maxLength: 40, maxWeight: 42 },
};

export const DEFAULT_PROJECT_INFO: ProjectInfo = {
  otpNumber: '',
  siteName: '',
  clientName: '',
  siteAddress: '',
  conductor: '',
  subcontractor: '',
  contactName: '',
  contactPhone: '',
  showSaturdays: false,
  showSundays: false,
  databaseComplete: false,
  databaseComment: '',
  supplyOnly: false,
  forecastedTransports: [],
  forecastPeriodStart: null,
  forecastPeriodEnd: null,
};
