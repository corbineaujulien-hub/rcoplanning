import { addYears, format, parseISO } from 'date-fns';
import * as XLSX from 'xlsx-js-style';

export interface CautionTracking {
  id?: string;
  project_id: string;
  caution_key: string;
  date_demande: string | null;
  date_obtention: string | null;
  date_echeance: string | null;
  echeance_manuelle: boolean;
  commentaire: string;
}
export const TRACKING_COLUMNS = 'id, project_id, caution_key, date_demande, date_obtention, date_echeance, echeance_manuelle, commentaire';
export const VISIBLE_CAUTION_STATUSES = ['À demander', 'Demandée', 'Obtenue'];
export function automaticExpiry(date: string | null): string | null {
  return date ? format(addYears(parseISO(date), 1), 'yyyy-MM-dd') : null;
}
export function isOverdue(date: string | null, today = format(new Date(), 'yyyy-MM-dd')) {
  return !!date && date < today;
}
export function emptyTracking(project_id: string, caution_key: string): CautionTracking {
  return { project_id, caution_key, date_demande: null, date_obtention: null, date_echeance: null, echeance_manuelle: false, commentaire: '' };
}
export function remapTrackingRows(rows: CautionTracking[], projectId: string, ids: Map<string, string>) {
  return rows.flatMap(row => {
    const custom = row.caution_key.startsWith('custom:');
    const mapped = custom ? ids.get(row.caution_key.slice(7)) : row.caution_key;
    if (!mapped) return [];
    return [{ ...emptyTracking(projectId, custom ? `custom:${mapped}` : mapped),
      date_demande: row.date_demande, date_obtention: row.date_obtention, date_echeance: row.date_echeance,
      echeance_manuelle: row.echeance_manuelle, commentaire: row.commentaire }];
  });
}
export function excelDateSerial(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  const epoch = new Date(1899, 11, 30, 12);
  return Math.round((date.getTime() - epoch.getTime()) / 86400000);
}
export interface CautionExportRow extends CautionTracking { chantier: string; caution: string; statut: string; archived: boolean }
export function buildCautionsWorkbook(rows: CautionExportRow[]) {
  const data = [['Chantier', 'Caution', 'Statut', 'Date de demande', "Date d’obtention", "Date d’échéance", 'Commentaire', 'Chantier archivé'],
    ...rows.map(r => [r.chantier, r.caution, r.statut, r.date_demande ? excelDateSerial(r.date_demande) : '', r.date_obtention ? excelDateSerial(r.date_obtention) : '', r.date_echeance ? excelDateSerial(r.date_echeance) : '', r.commentaire, r.archived ? 'Oui' : ''])];
  const ws = XLSX.utils.aoa_to_sheet(data);
  rows.forEach((row, i) => [3, 4, 5].forEach(col => {
    const cell = ws[XLSX.utils.encode_cell({ r: i + 1, c: col })];
    if (cell?.t === 'n') { cell.z = 'DD/MM/YYYY'; if (col === 5 && isOverdue(row.date_echeance)) cell.s = { font: { color: { rgb: 'DC2626' }, bold: true } }; }
  }));
  ws['!autofilter'] = { ref: `A1:H${rows.length + 1}` };
  ws['!cols'] = [34, 30, 16, 19, 19, 19, 44, 18].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Suivi des cautions');
  return wb;
}

export async function fetchPaginated<T>(builder: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await builder().range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}