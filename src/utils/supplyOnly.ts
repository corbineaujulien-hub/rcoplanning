export const SUPPLY_ONLY_LABEL = 'Fourniture seule';
export const SUPPLY_ONLY_COLOR = '#1e3a5f';

export interface SupplyOnlyProject {
  supply_only?: boolean | null;
  client_name?: string | null;
  conductor?: string | null;
  design_manager?: string | null;
  subcontractor?: string | null;
}

export function stripPhone(s: string): string {
  return (s || '').split(' – ')[0].split(' - ')[0].trim();
}

export function formatCDTLabel(cdt: string | null | undefined): string {
  return stripPhone(cdt || '');
}

export function getDisplayCDT(p: SupplyOnlyProject): string {
  if (p.supply_only) return p.design_manager?.trim() || p.client_name?.trim() || 'Client non renseigné';
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

export const UNASSIGNED_CDE = 'CDE à désigner';

export function getDesignManagerFilterKey(p: SupplyOnlyProject): string {
  return p.design_manager?.trim() || UNASSIGNED_CDE;
}

export function matchesDesignManagerFilter(p: SupplyOnlyProject, selected: Set<string>): boolean {
  return selected.size === 0 || selected.has(getDesignManagerFilterKey(p));
}

export function getProjectInfoDisplayCDT(p: { supplyOnly?: boolean; designManager?: string | null; clientName: string; conductor: string }): string {
  return getDisplayCDT({ supply_only: p.supplyOnly, design_manager: p.designManager, client_name: p.clientName, conductor: p.conductor });
}

export function getFilterPoseur(p: SupplyOnlyProject): string {
  if (p.supply_only) return SUPPLY_ONLY_LABEL;
  return p.subcontractor || 'Poseur à désigner';
}