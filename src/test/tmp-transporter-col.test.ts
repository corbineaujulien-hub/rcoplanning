import { describe, it, expect } from 'vitest';
import XLSXStyle from 'xlsx-js-style';
import { exportWeeklyExcelStyled } from '@/utils/weeklyExcelExport';
import { BeamElement, DEFAULT_PROJECT_INFO, Team, Truck } from '@/types/delivery';

const els: Record<string, BeamElement> = {
  e1: { id: 'e1', repere: 'P1', zone: 'Z1', productType: 'Poteau BA', section: '20x20', length: 6, weight: 1.8, factory: 'A' },
  e2: { id: 'e2', repere: 'P2', zone: 'Z1', productType: 'Poteau BA', section: '20x20', length: 6, weight: 1.8, factory: 'A' },
};

const trucks: Truck[] = [
  { id: 't1', number: '1', date: '2026-09-28', time: '08:00', elementIds: ['e1'] },
  { id: 't2', number: '2', date: '2026-09-29', time: '08:00', elementIds: ['e2'], transporter: 'DUTHIL' },
];

const getTruckElements = (id: string): BeamElement[] =>
  (trucks.find(t => t.id === id)?.elementIds ?? []).map(e => els[e]);

describe('exportWeeklyExcelStyled transporter column', () => {
  it('always includes the Transporteur column', async () => {
    const noTransporter = trucks.filter(t => !t.transporter);
    const teams: Team[] = [{ id: 'team1', projectId: 'p1', name: 'Equipe 1', sortOrder: 1 }];

    const blob = exportWeeklyExcelStyled({
      selectedWeeks: [{ weekNumber: 40, year: 2026 }],
      allowedTrucks: noTransporter,
      getTruckElements,
      projectInfo: { ...DEFAULT_PROJECT_INFO, siteName: 'TEST' },
      teams,
      mode: 'single',
      asBlob: true,
    }) as Blob;

    const buf = new Uint8Array(await blob.arrayBuffer());
    const wb = XLSXStyle.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSXStyle.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false });
    const headerRow = aoa.find(r => r.includes('Date'));
    expect(headerRow).toBeDefined();
    expect(headerRow).toContain('Transporteur');
    const idx = headerRow.indexOf('Transporteur');
    const dataRows = aoa.slice(aoa.indexOf(headerRow) + 1).filter(r => r[1] === '08:00');
    expect(dataRows.length).toBeGreaterThan(0);
    dataRows.forEach(r => expect(r[idx]).toBe(''));
  });
});
