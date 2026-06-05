export const SUPPLY_ONLY_LABEL = 'Fourniture seule';
export const SUPPLY_ONLY_COLOR = '#1e3a5f';

export interface SupplyOnlyProject {
  supply_only?: boolean | null;
  client_name?: string | null;
  conductor?: string | null;
  subcontractor?: string | null;
}

function stripPhone(s: string): string {
  return (s || '').split(' – ')[0].split(' - ')[0].trim();
}

export function getDisplayCDT(p: SupplyOnlyProject): string {
  if (p.supply_only) return p.client_name?.trim() || 'Client non renseigné';
  return stripPhone(p.conductor || '') || 'CDT à désigner';
}

export function getDisplayPoseur(p: SupplyOnlyProject): string {
  if (p.supply_only) return SUPPLY_ONLY_LABEL;
  return p.subcontractor || 'Poseur à désigner';
}

export function getFilterCDT(p: SupplyOnlyProject): string {
  if (p.supply_only) return SUPPLY_ONLY_LABEL;
  return stripPhone(p.conductor || '') || 'CDT à désigner';
}

export function getFilterPoseur(p: SupplyOnlyProject): string {
  if (p.supply_only) return SUPPLY_ONLY_LABEL;
  return p.subcontractor || 'Poseur à désigner';
}