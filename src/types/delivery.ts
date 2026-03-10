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

export type AccessRole = 'admin' | 'editor' | 'viewer';

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
  'DUTHIL', 'MD', 'MPI', 'SG POSE', 'SAUVAGEON', 'LB MONTAGE'
] as const;

export const TRANSPORT_CATEGORIES: Record<TransportCategory, TransportInfo> = {
  standard: { category: 'standard', label: 'Plateau standard', maxLength: 13.5, maxWeight: 27 },
  cat1: { category: 'cat1', label: 'Extensible catégorie I', maxLength: 16.5, maxWeight: 27 },
  cat2: { category: 'cat2', label: 'Extensible catégorie II', maxLength: 21.5, maxWeight: 42 },
  cat3: { category: 'cat3', label: 'Extensible catégorie III', maxLength: 40, maxWeight: 42 },
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
};
