import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO, startOfISOWeek, endOfISOWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Truck } from '@/types/delivery';

interface WeekTab {
  weekNumber: number;
  year: number;
}

interface ExportPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weeklyTabs: WeekTab[];
  trucks: Truck[];
  onExport: (selectedWeeks: WeekTab[]) => void;
}

export default function ExportPdfModal({ open, onOpenChange, weeklyTabs, trucks, onExport }: ExportPdfModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(weeklyTabs.map(w => `${w.year}-${w.weekNumber}`)));

  // Reset selection when modal opens
  const handleOpenChange = (o: boolean) => {
    if (o) {
      setSelected(new Set(weeklyTabs.map(w => `${w.year}-${w.weekNumber}`)));
    }
    onOpenChange(o);
  };

  const availableWeeks = useMemo(() => {
    return weeklyTabs.filter(w => {
      return trucks.some(t => {
        const d = parseISO(t.date);
        return parseInt(format(d, 'II')) === w.weekNumber && d.getFullYear() === w.year;
      });
    }).map(w => {
      // Find first truck date in this week to compute week start/end
      const firstTruck = trucks.find(t => {
        const d = parseISO(t.date);
        return parseInt(format(d, 'II')) === w.weekNumber && d.getFullYear() === w.year;
      });
      const refDate = firstTruck ? parseISO(firstTruck.date) : new Date(w.year, 0, 1 + (w.weekNumber - 1) * 7);
      const weekStart = startOfISOWeek(refDate);
      const weekEnd = endOfISOWeek(refDate);
      const startLabel = format(weekStart, 'dd/MM', { locale: fr });
      const endLabel = format(weekEnd, 'dd/MM/yyyy', { locale: fr });
      return {
        ...w,
        key: `${w.year}-${w.weekNumber}`,
        label: `Semaine ${w.weekNumber} — du ${startLabel} au ${endLabel}`,
      };
    });
  }, [weeklyTabs, trucks]);

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(availableWeeks.map(w => w.key)));
  const deselectAll = () => setSelected(new Set());

  const handleExport = () => {
    const selectedWeeks = availableWeeks.filter(w => selected.has(w.key)).map(({ weekNumber, year }) => ({ weekNumber, year }));
    onExport(selectedWeeks);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Export PDF — Sélection des semaines</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={selectAll}>Tout sélectionner</Button>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={deselectAll}>Tout désélectionner</Button>
        </div>

        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2 pr-3">
            {availableWeeks.map(w => (
              <label key={w.key} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox checked={selected.has(w.key)} onCheckedChange={() => toggle(w.key)} />
                {w.label}
              </label>
            ))}
          </div>
        </ScrollArea>

        <p className="text-xs text-muted-foreground mt-1">
          {selected.size} semaine{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}
        </p>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={selected.size === 0} onClick={handleExport}>Exporter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
