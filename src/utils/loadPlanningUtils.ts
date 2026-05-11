import { TransportCategory, TRANSPORT_CATEGORIES } from '@/types/delivery';

export interface ISOWeek {
  year: number;
  week: number;
  key: string; // "2026-W18"
  start: Date; // Monday
  end: Date;   // Sunday
  label: string; // "S18"
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function startOfISOWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getISOWeekInfo(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function getWeeksBetween(startDate: Date, endDate: Date): ISOWeek[] {
  const weeks: ISOWeek[] = [];
  const cursor = startOfISOWeek(startDate);
  const end = startOfISOWeek(endDate);
  while (cursor.getTime() <= end.getTime()) {
    const info = getISOWeekInfo(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weeks.push({
      year: info.year,
      week: info.week,
      key: `${info.year}-W${String(info.week).padStart(2, '0')}`,
      start: new Date(cursor),
      end: weekEnd,
      label: `S${String(info.week).padStart(2, '0')}`,
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

export function getWeekKeyForDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const info = getISOWeekInfo(d);
  return `${info.year}-W${String(info.week).padStart(2, '0')}`;
}

// Stable hash for poseur color
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const POSEUR_PALETTE = [
  'hsl(210 90% 50%)', 'hsl(150 65% 42%)', 'hsl(28 90% 52%)', 'hsl(340 75% 52%)',
  'hsl(265 70% 55%)', 'hsl(190 80% 42%)', 'hsl(48 90% 50%)', 'hsl(0 75% 55%)',
  'hsl(120 50% 40%)', 'hsl(290 65% 55%)', 'hsl(15 75% 50%)', 'hsl(220 60% 35%)',
];

export const UNASSIGNED_POSEUR = 'Poseur à désigner';
export const UNASSIGNED_COLOR = 'hsl(220 9% 64%)';

export function getPoseurColor(poseur: string | null | undefined): string {
  if (!poseur || poseur === UNASSIGNED_POSEUR) return UNASSIGNED_COLOR;
  return POSEUR_PALETTE[hashStr(poseur) % POSEUR_PALETTE.length];
}

export const CATEGORY_LABELS: Record<TransportCategory, string> = {
  standard: TRANSPORT_CATEGORIES.standard.label,
  cat1: TRANSPORT_CATEGORIES.cat1.label,
  cat2: TRANSPORT_CATEGORIES.cat2.label,
  cat3: TRANSPORT_CATEGORIES.cat3.label,
};

export function dateInRange(dateStr: string, startStr: string, endStr: string): boolean {
  return dateStr >= startStr && dateStr <= endStr;
}

export function weekOverlapsRange(week: ISOWeek, startStr: string, endStr: string): boolean {
  const start = parseLocalDate(startStr);
  const end = parseLocalDate(endStr);
  return week.end.getTime() >= start.getTime() && week.start.getTime() <= end.getTime();
}

export interface CellData {
  count: number;
  isReal: boolean; // true = at least 1 real truck this week, false = forecast only
  hasForecast: boolean;
  hasReal: boolean;
}

export const PARSE_LOCAL = parseLocalDate;