import * as XLSX from 'xlsx';
import { ISOWeek } from './loadPlanningUtils';

interface ProjectComputedLite {
  project: { id: string; site_name: string | null; otp_number: string | null };
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
}

function buildLoadSheet(rows: { key: string; perWeek: Record<string, number> }[], weeks: ISOWeek[]): any[][] {
  const header = ['', ...weeks.map(w => w.label)];
  const data = rows.map(r => [r.key, ...weeks.map(w => Math.round((r.perWeek[w.key] || 0) * 10) / 10 || '')]);
  return [header, ...data];
}

export async function exportLoadPlanningExcel(args: ExportArgs) {
  const { weeks, projects, loadByCdt, loadByPoseur, loadByUsine, periodStart, periodEnd } = args;
  const wb = XLSX.utils.book_new();

  // Gantt
  const ganttHeader = ['Chantier', 'OTP', 'CDT', 'Poseur', ...weeks.map(w => w.label)];
  const ganttRows = projects.map(cp => [
    cp.project.site_name || '', cp.project.otp_number || '',
    cp.conductor, cp.poseur,
    ...weeks.map(w => {
      const c = cp.weeks[w.key];
      if (!c || !c.count) return '';
      return `${Math.round(c.count * 10) / 10}${c.source === 'forecast' ? ' (P)' : ''}`;
    }),
  ]);
  const wsGantt = XLSX.utils.aoa_to_sheet([ganttHeader, ...ganttRows]);
  XLSX.utils.book_append_sheet(wb, wsGantt, 'Gantt');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildLoadSheet(loadByCdt, weeks)), 'Charge CDT');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildLoadSheet(loadByPoseur, weeks)), 'Charge Poseur');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildLoadSheet(loadByUsine, weeks)), 'Charge Usine');

  XLSX.writeFile(wb, `planning_charge_${periodStart}_${periodEnd}.xlsx`);
}