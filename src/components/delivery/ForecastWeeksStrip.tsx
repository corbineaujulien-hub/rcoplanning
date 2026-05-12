import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function getISOWeekInfo(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function startOfISOWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export interface StripWeek {
  year: number;
  weekNumber: number;
  key: string;
  start: Date;
  end: Date;
  dateRange: string;
}

export interface StripMonth {
  label: string;
  weeks: StripWeek[];
}

export function buildSlidingStripMonths(
  monthsCount = 12,
  startOffset = 0,
  fromDate?: Date,
  toDate?: Date,
): StripMonth[] {
  const today = new Date();
  const startMonth = fromDate
    ? new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)
    : new Date(today.getFullYear(), today.getMonth() + startOffset, 1);
  const endMonth = toDate
    ? new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0)
    : new Date(today.getFullYear(), today.getMonth() + startOffset + monthsCount, 0);
  const totalMonths = (endMonth.getFullYear() - startMonth.getFullYear()) * 12 +
    (endMonth.getMonth() - startMonth.getMonth()) + 1;

  const months: StripMonth[] = [];
  for (let i = 0; i < totalMonths; i++) {
    const m = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
    months.push({
      label: m.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
        .replace(/^./, c => c.toUpperCase()).replace('.', ''),
      weeks: [],
    });
  }
  const fmtDay = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

  const cur = startOfISOWeek(startMonth);
  while (cur.getTime() <= endMonth.getTime()) {
    const wEnd = new Date(cur); wEnd.setDate(wEnd.getDate() + 6);
    // owner = month with most days
    const counts: Record<string, { y: number; m: number; n: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(cur); d.setDate(d.getDate() + i);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (!counts[k]) counts[k] = { y: d.getFullYear(), m: d.getMonth(), n: 0 };
      counts[k].n++;
    }
    const owner = Object.values(counts).sort((a, b) => b.n - a.n)[0];
    const info = getISOWeekInfo(cur);
    const target = months.find((m, i) => {
      const dt = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      return dt.getFullYear() === owner.y && dt.getMonth() === owner.m;
    });
    if (target) {
      target.weeks.push({
        year: info.year,
        weekNumber: info.week,
        key: `${info.year}-${info.week}`,
        start: new Date(cur),
        end: new Date(wEnd),
        dateRange: `du ${fmtDay(cur)} au ${fmtDay(wEnd)}/${wEnd.getFullYear()}`,
      });
    }
    cur.setDate(cur.getDate() + 7);
  }
  return months.filter(m => m.weeks.length > 0);
}

interface Props {
  selected: string[];
  onToggle: (year: number, weekNumber: number) => void;
  cellWidth?: number;
  cellHeight?: number;
  monthsCount?: number;
  startOffset?: number;
  fromDate?: Date;
  toDate?: Date;
}

export default function ForecastWeeksStrip({
  selected, onToggle, cellWidth = 32, cellHeight = 32, monthsCount = 12, startOffset = 0,
  fromDate, toDate,
}: Props) {
  const months = useMemo(
    () => buildSlidingStripMonths(monthsCount, startOffset, fromDate, toDate),
    [monthsCount, startOffset, fromDate?.getTime(), toDate?.getTime()],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto border rounded-md bg-background">
        <div className="inline-flex flex-col min-w-full">
          <div className="flex">
            {months.map((m, i) => (
              <div
                key={i}
                style={{ width: m.weeks.length * cellWidth }}
                className={cn(
                  'text-center text-[11px] font-semibold capitalize bg-muted/50 py-1 select-none',
                  i < months.length - 1 && 'border-r',
                )}
              >
                {m.label}
              </div>
            ))}
          </div>
          <div className="flex">
            {months.map((m, i) => (
              <div key={i} className={cn('flex', i < months.length - 1 && 'border-r')}>
                {m.weeks.map(w => {
                  const isSel = selectedSet.has(w.key);
                  return (
                    <Tooltip key={w.key}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onToggle(w.year, w.weekNumber)}
                          style={{ width: cellWidth, height: cellHeight }}
                          className={cn(
                            'text-[10px] font-medium border-b border-t border-l last:border-r transition-colors',
                            isSel
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-muted-foreground hover:bg-muted',
                          )}
                        >
                          S{w.weekNumber}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>S{w.weekNumber} — {w.dateRange}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
