import { beforeEach, expect, it, vi } from 'vitest';

const { inserts, from } = vi.hoisted(() => {
  const inserts: { table: string; rows: any }[] = [];
  const from = vi.fn((table: string) => ({
    insert: (rows: any) => {
      inserts.push({ table, rows });
      return { error: null, select: () => ({ single: async () => ({ data: { token: 'test' }, error: null }) }) };
    },
  }));
  return { inserts, from };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
import { importProjectBundle, ProjectBundle } from '@/utils/projectArchive';

beforeEach(() => { inserts.length = 0; });
const bundle = (project: object): ProjectBundle => ({
  formatVersion: 1, exportedAt: '', project, teams: [], beam_elements: [], trucks: [], plans: [],
  forecast_weeks: [], forecast_slots: [], forecast_history: [], adv_status: [], adv_cautions_custom: [], adv_relances: [], adv_historique: [],
});
it('restaure le chargé d’études lors de la réimportation', async () => {
  await importProjectBundle(bundle({ design_manager: 'Taoufik ELKHATTABI' }));
  expect(inserts.find(i => i.table === 'projects')?.rows.design_manager).toBe('Taoufik ELKHATTABI');
});
it('importe les anciens fichiers sans chargé d’études avec une valeur nulle', async () => {
  await importProjectBundle(bundle({ site_name: 'Ancien chantier' }));
  expect(inserts.find(i => i.table === 'projects')?.rows.design_manager).toBeNull();
});