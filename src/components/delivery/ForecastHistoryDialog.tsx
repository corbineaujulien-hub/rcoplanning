import React, { useState, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History as HistoryIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForecastHistory, ForecastSnapshot, ForecastSnapshotWeek } from '@/hooks/useForecastHistory';

function weekToOrdinal(w: { year: number; weekNumber: number }): number {
  return w.year * 53 + w.weekNumber;
}

function formatSnapshotDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function describeWeeks(weeks: ForecastSnapshotWeek[]): string {
  if (weeks.length === 0) return 'Aucune semaine cochée';
  const sorted = [...weeks].sort((a, b) => weekToOrdinal(a) - weekToOrdinal(b));
  return sorted.map(w => `S${w.weekNumber}`).join(', ');
}

function shiftLabel(snapshot: ForecastSnapshot, initial: ForecastSnapshot | null): { text: string; color: string } {
  if (!initial || snapshot.id === initial.id) {
    return { text: 'Référence — planning de signature du contrat', color: 'text-muted-foreground' };
  }
  if (snapshot.weeks.length === 0 || initial.weeks.length === 0) {
    return { text: 'Décalage vs planning initial : non calculable', color: 'text-muted-foreground' };
  }
  const initStart = Math.min(...initial.weeks.map(weekToOrdinal));
  const initEnd = Math.max(...initial.weeks.map(weekToOrdinal));
  const curStart = Math.min(...snapshot.weeks.map(weekToOrdinal));
  const curEnd = Math.max(...snapshot.weeks.map(weekToOrdinal));
  const startShift = curStart - initStart;
  const endShift = curEnd - initEnd;
  if (startShift === 0 && endShift === 0) {
    return { text: 'Décalage vs planning initial : Aucun changement', color: 'text-muted-foreground' };
  }
  const sortedInit = [...initial.weeks].sort((a, b) => weekToOrdinal(a) - weekToOrdinal(b));
  const sortedCur = [...snapshot.weeks].sort((a, b) => weekToOrdinal(a) - weekToOrdinal(b));
  const initEndW = sortedInit[sortedInit.length - 1];
  const curEndW = sortedCur[sortedCur.length - 1];
  const abs = Math.abs(endShift);
  const plural = abs > 1 ? 's' : '';
  let detail: string;
  if (endShift > 0) {
    detail = `+${endShift} semaine${plural} (fin repoussée du S${initEndW.weekNumber} au S${curEndW.weekNumber})`;
  } else if (endShift < 0) {
    detail = `${endShift} semaine${plural} (fin avancée du S${initEndW.weekNumber} au S${curEndW.weekNumber})`;
  } else {
    const absS = Math.abs(startShift);
    detail = `${startShift > 0 ? '+' : ''}${startShift} semaine${absS > 1 ? 's' : ''} (début décalé)`;
  }
  const color = endShift > 0 || startShift > 0 ? 'text-red-600' : 'text-green-600';
  return { text: `Décalage vs planning initial : ${detail}`, color };
}

export function ForecastHistoryList({ history }: { history: ForecastSnapshot[] }) {
  const initial = history.find(h => h.isInitial) || (history.length > 0 ? history[history.length - 1] : null);
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Aucun snapshot enregistré.</p>;
  }
  return (
    <div className="max-h-[60vh] overflow-y-auto pr-2 text-sm min-w-[480px] divide-y">
      {history.map(snap => {
        const shift = shiftLabel(snap, initial);
        const isInit = initial ? snap.id === initial.id : false;
        return (
          <div key={snap.id} className="py-3 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="font-medium tabular-nums whitespace-nowrap">
                📅 {formatSnapshotDate(snap.snapshotDate)}
              </span>
              <span className="text-muted-foreground whitespace-nowrap">
                — {snap.userEmail || 'inconnu'}
              </span>
              {isInit && (
                <span className="ml-1 inline-flex items-center rounded bg-accent text-accent-foreground px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
                  PLANNING INITIAL
                </span>
              )}
            </div>
            <div className="text-xs">
              <span className="font-medium">Semaines :</span>{' '}
              <span className="text-muted-foreground">{describeWeeks(snap.weeks)}</span>
            </div>
            <div className={cn('text-xs font-medium', shift.color)}>
              {shift.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ForecastHistoryDialogProps {
  projectId: string;
  currentWeeks: ForecastSnapshotWeek[];
  siteLabel?: string;
  trigger?: ReactNode;
  ready?: boolean;
}

export default function ForecastHistoryDialog({ projectId, currentWeeks, siteLabel, trigger, ready = true }: ForecastHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const { history } = useForecastHistory(projectId, currentWeeks, ready);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <HistoryIcon className="h-4 w-4 mr-2" />
            Historique
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-fit max-w-4xl" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            Historique du planning prévisionnel{siteLabel ? ` — ${siteLabel}` : ''}
          </DialogTitle>
        </DialogHeader>
        <ForecastHistoryList history={history} />
      </DialogContent>
    </Dialog>
  );
}