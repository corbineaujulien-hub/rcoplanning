import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Factory, Truck as TruckIcon } from 'lucide-react';
import { format, parseISO, startOfISOWeek, endOfISOWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Truck, BeamElement } from '@/types/delivery';

interface WeekTab { weekNumber: number; year: number; }

interface ExportResult {
  selectedWeeks: WeekTab[];
  filteredTrucks: Truck[];
  filenameSuffix: string;
}

interface ExportWeeksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weeklyTabs: WeekTab[];
  trucks: Truck[];
  getTruckElements: (id: string) => BeamElement[];
  onExport: (result: ExportResult) => void;
  title: string;
}

const NO_TRANSPORTER = '__none__';

const slug = (s: string) =>
  s.trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    || 'NA';

export default function ExportWeeksModal({ open, onOpenChange, weeklyTabs, trucks, getTruckElements, onExport, title }: ExportWeeksModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(weeklyTabs.map(w => `${w.year}-${w.weekNumber}`)));
  const [factorySet, setFactorySet] = useState<Set<string>>(new Set());
  const [transporterSet, setTransporterSet] = useState<Set<string>>(new Set());

  const handleOpenChange = (o: boolean) => {
    if (o) setSelected(new Set(weeklyTabs.map(w => `${w.year}-${w.weekNumber}`)));
    onOpenChange(o);
  };

  // When the modal opens (controlled from parent), make sure all weeks are selected by default.
  useEffect(() => {
    if (open) {
      setSelected(new Set(weeklyTabs.map(w => `${w.year}-${w.weekNumber}`)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, weeklyTabs.length]);

  const availableWeeks = useMemo(() => {
    return weeklyTabs.filter(w =>
      trucks.some(t => {
        const d = parseISO(t.date);
        return parseInt(format(d, 'II')) === w.weekNumber && d.getFullYear() === w.year;
      })
    ).map(w => {
      const firstTruck = trucks.find(t => {
        const d = parseISO(t.date);
        return parseInt(format(d, 'II')) === w.weekNumber && d.getFullYear() === w.year;
      });
      const refDate = firstTruck ? parseISO(firstTruck.date) : new Date(w.year, 0, 1 + (w.weekNumber - 1) * 7);
      const weekStart = startOfISOWeek(refDate);
      const weekEnd = endOfISOWeek(refDate);
      return {
        ...w,
        key: `${w.year}-${w.weekNumber}`,
        label: `Semaine ${w.weekNumber} — du ${format(weekStart, 'dd/MM', { locale: fr })} au ${format(weekEnd, 'dd/MM/yyyy', { locale: fr })}`,
      };
    });
  }, [weeklyTabs, trucks]);

  // Trucks across ALL available weeks (used to populate filter options).
  const weekTrucks = useMemo(() => {
    const availableKeys = new Set(availableWeeks.map(w => w.key));
    return trucks.filter(t => {
      const d = parseISO(t.date);
      return availableKeys.has(`${d.getFullYear()}-${parseInt(format(d, 'II'))}`);
    });
  }, [trucks, availableWeeks]);

  // Decorate trucks with their factories + transporter key
  const decorated = useMemo(() => weekTrucks.map(t => ({
    truck: t,
    factories: Array.from(new Set(getTruckElements(t.id).map(e => e.factory).filter(Boolean))),
    transporterKey: (t.transporter && t.transporter.trim()) ? t.transporter.trim() : NO_TRANSPORTER,
  })), [weekTrucks, getTruckElements]);

  const allFactories = useMemo(() => {
    const s = new Set<string>();
    decorated.forEach(d => d.factories.forEach(f => s.add(f)));
    return Array.from(s).sort();
  }, [decorated]);

  const allTransporters = useMemo(() => {
    const s = new Set<string>();
    decorated.forEach(d => s.add(d.transporterKey));
    return Array.from(s).sort((a, b) => {
      if (a === NO_TRANSPORTER) return 1;
      if (b === NO_TRANSPORTER) return -1;
      return a.localeCompare(b);
    });
  }, [decorated]);

  // Reset filters to "all" when the available pool changes (or modal opens).
  useEffect(() => {
    setFactorySet(new Set(allFactories));
    setTransporterSet(new Set(allTransporters));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allFactories.join('|'), allTransporters.join('|')]);

  // Display lists with cumulative AND logic
  const displayFactories = useMemo(() => {
    return allFactories.filter(f =>
      decorated.some(d => d.factories.includes(f) && transporterSet.has(d.transporterKey))
    );
  }, [allFactories, decorated, transporterSet]);

  const displayTransporters = useMemo(() => {
    return allTransporters.filter(tk =>
      decorated.some(d => d.transporterKey === tk && d.factories.some(f => factorySet.has(f)))
    );
  }, [allTransporters, decorated, factorySet]);

  const toggleWeek = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const selectAllWeeks = () => setSelected(new Set(availableWeeks.map(w => w.key)));
  const deselectAllWeeks = () => setSelected(new Set());

  const toggleSetVal = (set: Set<string>, setter: (s: Set<string>) => void, val: string) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    setter(next);
  };

  const resetFilters = () => {
    setFactorySet(new Set(allFactories));
    setTransporterSet(new Set(allTransporters));
  };

  const handleExport = () => {
    const selectedWeeks = availableWeeks.filter(w => selected.has(w.key)).map(({ weekNumber, year }) => ({ weekNumber, year }));

    const selectedKeys = new Set(selectedWeeks.map(w => `${w.year}-${w.weekNumber}`));
    const filteredTrucks = decorated
      .filter(d => {
        const dt = parseISO(d.truck.date);
        const key = `${dt.getFullYear()}-${parseInt(format(dt, 'II'))}`;
        return selectedKeys.has(key)
          && d.factories.some(f => factorySet.has(f))
          && transporterSet.has(d.transporterKey);
      })
      .map(d => d.truck);

    let suffix = '';
    const partialFactory = factorySet.size < allFactories.length;
    if (partialFactory) {
      const arr = Array.from(factorySet);
      suffix += arr.length === 1 ? `_${slug(arr[0])}` : '_MultiUsines';
    }
    const partialTransporter = transporterSet.size < allTransporters.length;
    if (partialTransporter) {
      const arr = Array.from(transporterSet);
      if (arr.length === 1) {
        suffix += `_${arr[0] === NO_TRANSPORTER ? 'SansTransporteur' : slug(arr[0])}`;
      } else {
        suffix += '_MultiTransporteurs';
      }
    }

    onExport({ selectedWeeks, filteredTrucks, filenameSuffix: suffix });
    onOpenChange(false);
  };

  const factoryActive = factorySet.size !== allFactories.length;
  const transporterActive = transporterSet.size !== allTransporters.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[460px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[65vh] pr-3">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={selectAllWeeks}>Tout sélectionner</Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={deselectAllWeeks}>Tout désélectionner</Button>
          </div>

          <div className="space-y-2">
            {availableWeeks.map(w => (
              <label key={w.key} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox checked={selected.has(w.key)} onCheckedChange={() => toggleWeek(w.key)} />
                {w.label}
              </label>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            {selected.size} semaine{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}
          </p>

          <Separator className="my-3" />

          <p className="text-sm font-semibold mb-2">Filtres</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={factoryActive ? 'default' : 'outline'} size="sm">
                    <Factory className="h-4 w-4 mr-1" />
                    {factoryActive ? `Usine (${factorySet.size})` : 'Usine'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 max-h-80 overflow-auto p-2" align="start">
                  <div className="space-y-1">
                    {displayFactories.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">Aucune usine</span>
                    )}
                    {displayFactories.map(f => (
                      <label key={f} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                        <Checkbox checked={factorySet.has(f)} onCheckedChange={() => toggleSetVal(factorySet, setFactorySet, f)} />
                        <span className="text-xs">{f}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={transporterActive ? 'default' : 'outline'} size="sm">
                    <TruckIcon className="h-4 w-4 mr-1" />
                    {transporterActive ? `Transporteur (${transporterSet.size})` : 'Transporteur'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 max-h-64 overflow-auto p-2" align="start">
                  <div className="space-y-1">
                    {displayTransporters.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">Aucun transporteur</span>
                    )}
                    {displayTransporters.map(t => (
                      <label key={t} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                        <Checkbox checked={transporterSet.has(t)} onCheckedChange={() => toggleSetVal(transporterSet, setTransporterSet, t)} />
                        {t === NO_TRANSPORTER
                          ? <span className="text-xs italic text-muted-foreground">Sans transporteur</span>
                          : <span className="text-xs font-medium text-orange-500">{t}</span>}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Réinitialiser les filtres
            </button>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={selected.size === 0} onClick={handleExport}>Exporter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
