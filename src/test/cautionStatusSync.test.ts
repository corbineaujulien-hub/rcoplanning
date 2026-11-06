import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyTracking } from '@/utils/cautionTracking';

const mocks = vi.hoisted(() => ({ from: vi.fn(), notify: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/utils/advSync', () => ({ notifyAdvChanged: mocks.notify }));
import { updateCautionStatus } from '@/utils/cautionStatus';

function builder(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const name of ['update', 'eq', 'neq', 'is', 'select', 'insert', 'upsert']) chain[name] = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);
  return chain;
}
const change = { projectId: 'p', cautionKey: 'caution_rg', label: 'Caution RG', oldStatus: 'Demandée', newStatus: 'Obtenue', userEmail: '' };
describe('Caution status confirmation', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(['caution_rg', 'garantie_paiement_st', 'custom:123'])('returns authoritative status and dates for %s', key => {
    const tracking = { ...emptyTracking('p', key), date_obtention: '2026-11-06', date_echeance: '2027-11-06' };
    mocks.from.mockImplementation((table: string) => builder({ data: table === 'adv_caution_tracking' ? tracking : { [key]: 'Obtenue', statut: 'Obtenue' }, error: null }));
    return updateCautionStatus({ ...change, cautionKey: key }).then(result => {
      expect(result.data).toEqual({ status: 'Obtenue', tracking });
      expect(mocks.notify).toHaveBeenCalledWith('p');
    });
  });
  it('reports write failure without confirming or notifying', async () => {
    mocks.from.mockReturnValue(builder({ error: 'denied' }));
    expect(await updateCautionStatus(change)).toEqual({ error: 'denied' });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it('restores the exact dates after the undo status trigger', async () => {
    const snapshot = { ...emptyTracking('p', 'caution_rg'), date_demande: '2025-10-01', date_obtention: '2025-10-02', date_echeance: '2028-03-01', echeance_manuelle: true };
    const trackingBuilder = builder({ data: snapshot, error: null });
    mocks.from.mockImplementation((table: string) => table === 'adv_caution_tracking' ? trackingBuilder : builder({ data: { caution_rg: 'Obtenue' }, error: null }));
    const result = await updateCautionStatus({ ...change, oldStatus: 'Non nécessaire', restoreTracking: snapshot });
    expect(trackingBuilder.upsert).toHaveBeenCalledWith(snapshot, { onConflict: 'project_id,caution_key' });
    expect(result.data?.tracking).toEqual(snapshot);
  });
});