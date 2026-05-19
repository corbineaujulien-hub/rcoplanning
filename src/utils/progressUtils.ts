import type { BeamElement, Truck } from '@/types/delivery';

/**
 * Computes planning progress as loadedWeight / totalWeight * 100.
 * Single source of truth shared by Home tiles, Chantier header and Load planning.
 */
export function calculatePlanningProgress(
  beamElements: Pick<BeamElement, 'id' | 'weight'>[],
  trucks: Pick<Truck, 'elementIds'>[]
): { totalWeight: number; loadedWeight: number; pct: number } {
  const totalWeight = beamElements.reduce((s, e) => s + (Number(e.weight) || 0), 0);
  if (totalWeight === 0) return { totalWeight: 0, loadedWeight: 0, pct: 0 };
  const assigned = new Set<string>();
  trucks.forEach(t => (t.elementIds || []).forEach(id => assigned.add(id)));
  const weightById = new Map<string, number>();
  beamElements.forEach(e => weightById.set(e.id, Number(e.weight) || 0));
  let loadedWeight = 0;
  assigned.forEach(id => { loadedWeight += weightById.get(id) || 0; });
  return { totalWeight, loadedWeight, pct: (loadedWeight / totalWeight) * 100 };
}