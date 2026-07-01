import * as XLSX from 'xlsx';
import { ISOWeek } from './loadPlanningUtils';

interface ProjectComputedLite {
  project: { id: string; site_name: string | null; otp_number: string | null; site_address?: string | null };
  poseur: string;
  conductor: string;
  weeks: Record<string, { count: number; source: 'real' | 'forecast' | 'mixed' | 'none' }>;
}

interface ExportArgs {
  weeks: ISOWeek[];
  projects: ProjectComputedLite[];
  loadByCdt: { key: string; perWeek: Record<string, number> }[];
  loadByPoseur: { key: string; perWeek: Record<string, number> }[];
  loadByUsine: { key: string; perWeek: Record<string, number> }[];
  periodStart: string;
  periodEnd: string;
  productSuffix?: string;
}

function buildLoadSheet(
  rows: { key: string; perWeek: Record<string, number> }[],
  weeks: ISOWeek[],
  _ceil = false,
): any[][] {
  const header = ['', ...weeks.map(w => w.label), 'Total'];
  const fmt = (v: number) => v ? Math.ceil(v) : '';
  const data = rows.map(r => {
    const total = weeks.reduce((s, w) => s + (r.perWeek[w.key] || 0), 0);
    return [r.key, ...weeks.map(w => fmt(r.perWeek[w.key] || 0)), fmt(total)];
  });
  return [header, ...data];
}

function extractDepartement(address: string | null | undefined): string {
  if (!address) return '';
  const match = address.match(/\b(\d{5})\b/);
  if (!match) return '';
  const postalCode = match[1];
  if (postalCode.startsWith('97')) return postalCode.substring(0, 3);
  return postalCode.substring(0, 2);
}

export async function exportLoadPlanningExcel(args: ExportArgs) {
  const { weeks, projects, loadByCdt, loadByPoseur, loadByUsine, periodStart, periodEnd } = args;
  const wb = XLSX.utils.book_new();

  // Gantt
  const ganttHeader = ['Chantier', 'Département', 'OTP', 'CDT', 'Poseur', ...weeks.map(w => w.label), 'Total'];
  const ganttRows = projects.map(cp => {
    const total = weeks.reduce((s, w) => s + (cp.weeks[w.key]?.count || 0), 0);
    return [
      cp.project.site_name || '',
      extractDepartement(cp.project.site_address),
      cp.project.otp_number || '',
      cp.conductor, cp.poseur,
      ...weeks.map(w => {
        const c = cp.weeks[w.key];
        if (!c || !c.count) return '';
        return Math.ceil(c.count);
      }),
      total ? Math.ceil(total) : '',
    ];
  });
  const wsGantt = XLSX.utils.aoa_to_sheet([ganttHeader, ...ganttRows]);
  wsGantt['!cols'] = [
    { wpx: 200 }, // Chantier
    { wpx: 50 },  // Département
    { wpx: 90 },  // OTP
    { wpx: 90 },  // CDT
    { wpx: 90 },  // Poseur
    ...weeks.map(() => ({ wpx: 45 })),
    { wpx: 60 },  // Total
  ];
  XLSX.utils.book_append_sheet(wb, wsGantt, 'Gantt');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildLoadSheet(loadByCdt, weeks)), 'Charge CDT');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildLoadSheet(loadByPoseur, weeks)), 'Charge Poseur');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildLoadSheet(loadByUsine, weeks, true)), 'Charge Usine');

  XLSX.writeFile(wb, `planning_charge_${periodStart}_${periodEnd}${args.productSuffix || ''}.xlsx`);
}