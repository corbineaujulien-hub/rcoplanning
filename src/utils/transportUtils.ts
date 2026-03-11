import { BeamElement, TransportCategory, TRANSPORT_CATEGORIES } from '@/types/delivery';

const EXTENDED_LENGTH_TYPES = ['Poteau BA', 'Potelet BA'];

export function getTransportCategory(elements: BeamElement[]): TransportCategory {
  if (elements.length === 0) return 'standard';

  const totalWeight = elements.reduce((sum, el) => sum + el.weight, 0);
  const maxLength = Math.max(...elements.map(el => el.length));
  const hasExtendedType = elements.some(el => EXTENDED_LENGTH_TYPES.includes(el.productType));
  const effectiveStandardMax = hasExtendedType ? 14.5 : 13.5;

  if (maxLength <= effectiveStandardMax && totalWeight <= 27) return 'standard';
  if (maxLength <= 16.5 && totalWeight <= 27) return 'cat1';
  if (maxLength <= 21.5 && totalWeight <= 42) return 'cat2';
  return 'cat3';
}

export function getTruckWeight(elements: BeamElement[]): number {
  return elements.reduce((sum, el) => sum + el.weight, 0);
}

export function getTruckMaxLength(elements: BeamElement[]): number {
  if (elements.length === 0) return 0;
  return Math.max(...elements.map(el => el.length));
}

export function getTruckFactories(elements: BeamElement[]): string[] {
  return [...new Set(elements.map(el => el.factory).filter(Boolean))];
}

export function getTruckZones(elements: BeamElement[]): string[] {
  return [...new Set(elements.map(el => el.zone).filter(Boolean))];
}

export function getProductCountsByType(elements: BeamElement[]): Record<string, number> {
  const counts: Record<string, number> = {};
  elements.forEach(el => {
    counts[el.productType] = (counts[el.productType] || 0) + 1;
  });
  return counts;
}

export function getCategoryColorClass(category: TransportCategory): string {
  switch (category) {
    case 'standard': return 'bg-transport-standard text-transport-standard-foreground';
    case 'cat1': return 'bg-transport-cat1 text-transport-cat1-foreground';
    case 'cat2': return 'bg-transport-cat2 text-transport-cat2-foreground';
    case 'cat3': return 'bg-transport-cat3 text-transport-cat3-foreground';
  }
}

export function getCategoryBorderClass(category: TransportCategory): string {
  switch (category) {
    case 'standard': return 'border-transport-standard';
    case 'cat1': return 'border-transport-cat1';
    case 'cat2': return 'border-transport-cat2';
    case 'cat3': return 'border-transport-cat3';
  }
}

export function isNonStandard(elements: BeamElement[]): boolean {
  return getTransportCategory(elements) !== 'standard';
}

export function isMultiSite(elements: BeamElement[]): boolean {
  return getTruckFactories(elements).length > 1;
}

const FACTORY_COLORS: Record<string, string> = {
  'BRIVE': '#2563eb',
  'BRIVE LA GAILLARDE': '#2563eb',
  'COULOUNIEIX': '#059669',
  'COULOUNIEIX CHAMIERS': '#059669',
  'COULOUNIEIX-CHAMIERS': '#059669',
  'PERIGUEUX': '#d97706',
  'LIMOGES': '#7c3aed',
  'BORDEAUX': '#dc2626',
  'TOULOUSE': '#0891b2',
  'AGEN': '#c026d3',
  'MONTAUBAN': '#ea580c',
  'PAU': '#0d9488',
  'CAHORS': '#b91c1c',
  'BERGERAC': '#4f46e5',
  'DSR': '#0284c7',
  'CSB': '#9333ea',
  'THO': '#15803d',
  'VOR': '#a21caf',
  'TOU': '#0e7490',
  'COU': '#059669',
  'BER': '#4f46e5',
  'VER': '#ca8a04',
  'NER': '#be123c',
  'EDP': '#6d28d9',
  'VGB': '#0f766e',
  'KP1': '#c2410c',
  'A2C': '#1d4ed8',
  'GUIMARD': '#7e22ce',
  'IB': '#b45309',
  'CGM': '#166534',
};

export function getFactoryColor(factory: string): string {
  const key = factory.toUpperCase().trim();
  return FACTORY_COLORS[key] || '#6b7280';
}
