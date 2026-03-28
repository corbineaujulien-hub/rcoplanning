import React, { useState, useMemo, useCallback } from 'react';
import { Truck } from '@/types/delivery';
import { getTransportCategory, getCategoryBorderClass, getProductCountsByType, getTruckFactories } from '@/utils/transportUtils';
import { isHoliday } from '@/utils/frenchHolidays';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, isSameMonth, isSameDay, isToday, getDay, getISOWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BeamElement } from '@/types/delivery';

interface ShiftCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trucks: Truck[];
  getTruckElements: (truckId: string) => BeamElement[];
  showSaturdays: boolean;
  onShiftConfirm: (selectedTruckIds: Set<string>, shiftType: 'weeks' | 'days' | 'hours', shiftValue: number) => void;
}

export default function ShiftCalendarDialog({
  open,
  onOpenChange,
  trucks,
  getTruckElements,
  showSaturdays,
  onShiftConfirm,
}: ShiftCalendarDialogProps) {
  const [shiftViewMode, setShiftViewMode] = useState<'month' | 'week'>('month');
  const [shiftCalDate, setShiftCalDate] = useState(() => new Date());
  const [selectedTrucks, setSelectedTrucks] = useState<Set<string>>(new Set());
  const [shiftType, setShiftType] = useState<'weeks' | 'days' | 'hours'>('days');
  const [shiftValue, setShiftValue] = useState('');

  // Reset state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setSelectedTrucks(new Set());
      setShiftValue('');
      setShiftType('days');
      // Start calendar at earliest truck date or today
      const truckDates = trucks.filter(t => t.date).map(t => {
        const [y, m, d] = t.date.split('-').map(Number);
        return new Date(y, m - 1, d);
      });
      if (truckDates.length > 0) {
        setShiftCalDate(new Date(Math.min(...truckDates.map(d => d.getTime()))));
      } else {
        setShiftCalDate(new Date());
      }
    }
    onOpenChange(open);
  };

  const isNonWorkingDay = useCallback((date: Date): boolean => {
    const dow = date.getDay();
    if (dow === 0) return true;
    if (dow === 6 && !showSaturdays) return true;
    return isHoliday(format(date, 'yyyy-MM-dd'));
  }, [showSaturdays]);

  // Build a map of date -> trucks
  const trucksByDate = useMemo(() => {
    const map: Record<string, Truck[]> = {};
    trucks.forEach(t => {
      if (!t.date) return;
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });
    // Sort each day's trucks by time
    Object.values(map).forEach(arr => arr.sort((a, b) => a.time.localeCompare(b.time)));
    return map;
  }, [trucks]);

  const gridCols = showSaturdays ? 6 : 5;
  const dayNames = showSaturdays ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];

  const filterWeekendDays = useCallback((days: Date[]): Date[] => {
    return days.filter(day => {
      const dow = getDay(day);
      if (dow === 0) return false;
      if (dow === 6 && !showSaturdays) return false;
      return true;
    });
  }, [showSaturdays]);

  // Calendar days
  const calendarDays = useMemo(() => {
    if (shiftViewMode === 'month') {
      const start = startOfWeek(startOfMonth(shiftCalDate), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(shiftCalDate), { weekStartsOn: 1 });
      return filterWeekendDays(eachDayOfInterval({ start, end }));
    } else {
      const start = startOfWeek(shiftCalDate, { weekStartsOn: 1 });
      const end = endOfWeek(shiftCalDate, { weekStartsOn: 1 });
      return filterWeekendDays(eachDayOfInterval({ start, end }));
    }
  }, [shiftCalDate, shiftViewMode, filterWeekendDays]);

  const navigate = (dir: number) => {
    setShiftCalDate(prev =>
      shiftViewMode === 'month'
        ? (dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1))
        : (dir > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1))
    );
  };

  const goToday = () => setShiftCalDate(new Date());

  const toggleTruck = (truckId: string) => {
    setSelectedTrucks(prev => {
      const next = new Set(prev);
      next.has(truckId) ? next.delete(truckId) : next.add(truckId);
      return next;
    });
  };

  const toggleDayTrucks = (dateStr: string) => {
    const dayTrucks = trucksByDate[dateStr] || [];
    if (dayTrucks.length === 0) return;
    const allSelected = dayTrucks.every(t => selectedTrucks.has(t.id));
    setSelectedTrucks(prev => {
      const next = new Set(prev);
      dayTrucks.forEach(t => {
        if (allSelected) next.delete(t.id); else next.add(t.id);
      });
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTrucks(new Set(trucks.map(t => t.id)));
  };

  const deselectAll = () => {
    setSelectedTrucks(new Set());
  };

  const handleConfirm = () => {
    const val = parseInt(shiftValue, 10);
    if (isNaN(val) || val === 0 || selectedTrucks.size === 0) return;
    onShiftConfirm(selectedTrucks, shiftType, val);
    onOpenChange(false);
  };

  // Helper to build product counts and factories lines
  const getTruckInfo = (truck: Truck) => {
    const els = getTruckElements(truck.id);
    const cat = getTransportCategory(els);
    const borderClass = els.length === 0 ? 'border-l-foreground' : getCategoryBorderClass(cat);
    const counts = getProductCountsByType(els);
    const factories = getTruckFactories(els);
    const productsLine = Object.entries(counts).map(([type, n]) => `${type}(${n})`).join(' ');
    const factoriesLine = factories.join(', ');
    return { els, borderClass, productsLine, factoriesLine };
  };

  // Render a compact truck chip for month view
  const renderMonthTruckChip = (truck: Truck) => {
    const { els, borderClass, productsLine, factoriesLine } = getTruckInfo(truck);
    const isSelected = selectedTrucks.has(truck.id);

    return (
      <button
        key={truck.id}
        onClick={(e) => { e.stopPropagation(); toggleTruck(truck.id); }}
        className={`w-full text-left text-[8px] leading-tight px-1 py-0.5 rounded bg-card border-l-2 ${borderClass} transition-all ${isSelected ? 'ring-2 ring-primary ring-offset-1' : 'opacity-70 hover:opacity-100'}`}
      >
        <div className="font-medium">N°{truck.number} | {truck.time}</div>
        {els.length > 0 && (
          <>
            <div className="text-muted-foreground truncate">{productsLine}</div>
            <div className="text-muted-foreground truncate">{factoriesLine}</div>
          </>
        )}
      </button>
    );
  };

  // Render a truck card for week view
  const renderWeekTruckCard = (truck: Truck) => {
    const { els, borderClass, productsLine, factoriesLine } = getTruckInfo(truck);
    const isSelected = selectedTrucks.has(truck.id);

    return (
      <button
        key={truck.id}
        onClick={(e) => { e.stopPropagation(); toggleTruck(truck.id); }}
        className={`w-full text-left text-[9px] leading-tight px-1.5 py-1 rounded bg-card border-l-2 ${borderClass} transition-all ${isSelected ? 'ring-2 ring-primary ring-offset-1' : 'opacity-70 hover:opacity-100'}`}
      >
        <div className="font-medium">N°{truck.number} | {truck.time}</div>
        {els.length > 0 && (
          <>
            <div className="text-muted-foreground truncate">{productsLine}</div>
            <div className="text-muted-foreground truncate">{factoriesLine}</div>
          </>
        )}
      </button>
    );
  };

  // Month view
  const renderMonthView = () => {
    // Group days into weeks for ISO week numbers
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];
    calendarDays.forEach((day, i) => {
      currentWeek.push(day);
      if (currentWeek.length === gridCols || i === calendarDays.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    return (
      <div className="space-y-0">
        {/* Day names header */}
        <div className={`grid gap-px`} style={{ gridTemplateColumns: `2rem repeat(${gridCols}, 1fr)` }}>
          <div />
          {dayNames.map(dn => (
            <div key={dn} className="text-center text-[10px] font-medium text-muted-foreground py-1">{dn}</div>
          ))}
        </div>
        {/* Weeks */}
        <ScrollArea className="h-[40vh]">
          <div className="space-y-px">
            {weeks.map((week, wi) => {
              const weekNum = getISOWeek(week[0]);
              return (
                <div key={wi} className="grid gap-px" style={{ gridTemplateColumns: `2rem repeat(${gridCols}, 1fr)` }}>
                  <div className="text-[9px] text-muted-foreground flex items-start justify-center pt-1">S{weekNum}</div>
                  {week.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayTrucks = trucksByDate[dateStr] || [];
                    const isCurrentMonth = isSameMonth(day, shiftCalDate);
                    const holiday = isHoliday(dateStr);
                    const nonWorking = isNonWorkingDay(day);
                    const allSelected = dayTrucks.length > 0 && dayTrucks.every(t => selectedTrucks.has(t.id));
                    const someSelected = dayTrucks.some(t => selectedTrucks.has(t.id));

                    return (
                      <div
                        key={dateStr}
                        className={`min-h-[3.5rem] p-0.5 border rounded-sm transition-colors ${
                          !isCurrentMonth ? 'opacity-40' : ''
                        } ${nonWorking ? 'bg-muted/50' : 'bg-card'} ${
                          holiday ? 'bg-destructive/10' : ''
                        } ${isToday(day) ? 'border-primary' : 'border-border/50'} ${
                          allSelected ? 'bg-primary/10' : someSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <button
                          onClick={() => toggleDayTrucks(dateStr)}
                          className={`text-[10px] font-medium w-full text-left px-0.5 rounded hover:bg-muted/50 ${
                            isToday(day) ? 'text-primary font-bold' : 'text-foreground'
                          }`}
                        >
                          {format(day, 'd')}
                        </button>
                        <div className="space-y-0.5 mt-0.5">
                          {dayTrucks.map(t => renderMonthTruckChip(t))}
                        </div>
                      </div>
                    );
                  })}
                  {/* Pad incomplete last week */}
                  {week.length < gridCols && Array.from({ length: gridCols - week.length }).map((_, i) => (
                    <div key={`pad-${i}`} />
                  ))}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  // Week view
  const renderWeekView = () => {
    return (
      <ScrollArea className="h-[40vh]" style={{ overflowX: 'auto' }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${calendarDays.length}, minmax(120px, 1fr))` }}>
          {calendarDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayTrucks = trucksByDate[dateStr] || [];
            const holiday = isHoliday(dateStr);
            const nonWorking = isNonWorkingDay(day);
            const allSelected = dayTrucks.length > 0 && dayTrucks.every(t => selectedTrucks.has(t.id));
            const someSelected = dayTrucks.some(t => selectedTrucks.has(t.id));

            return (
              <div key={dateStr} className="flex flex-col">
                <button
                  onClick={() => toggleDayTrucks(dateStr)}
                  className={`text-center text-[10px] font-medium py-1.5 rounded-t border-b transition-colors ${
                    isToday(day) ? 'text-primary font-bold border-primary' : 'text-foreground border-border/50'
                  } ${nonWorking ? 'bg-muted/50' : ''} ${holiday ? 'bg-destructive/10' : ''} ${
                    allSelected ? 'bg-primary/10' : someSelected ? 'bg-primary/5' : ''
                  } hover:bg-muted/50`}
                >
                  <div>{format(day, 'EEE', { locale: fr })}</div>
                  <div>{format(day, 'dd/MM')}</div>
                </button>
                <div className={`flex-1 space-y-1 p-1 rounded-b border border-t-0 min-h-[8rem] ${
                  nonWorking ? 'bg-muted/30' : 'bg-card'
                } ${allSelected ? 'bg-primary/10' : someSelected ? 'bg-primary/5' : ''} border-border/50`}>
                  {dayTrucks.map(t => renderWeekTruckCard(t))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    );
  };

  const headerLabel = shiftViewMode === 'month'
    ? format(shiftCalDate, 'MMMM yyyy', { locale: fr })
    : `Semaine ${getISOWeek(shiftCalDate)} — ${format(startOfWeek(shiftCalDate, { weekStartsOn: 1 }), 'dd/MM', { locale: fr })} au ${format(endOfWeek(shiftCalDate, { weekStartsOn: 1 }), 'dd/MM/yyyy', { locale: fr })}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden" style={{ width: 'fit-content', minWidth: '600px', maxWidth: '95vw' }}>
        <DialogHeader>
          <DialogTitle>Décaler des camions</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* View toggle + Select all + counter */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              <Button
                variant={shiftViewMode === 'month' ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7"
                onClick={() => setShiftViewMode('month')}
              >
                Mois
              </Button>
              <Button
                variant={shiftViewMode === 'week' ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7"
                onClick={() => setShiftViewMode('week')}
              >
                Semaine
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {selectedTrucks.size} camion{selectedTrucks.size > 1 ? 's' : ''} sélectionné{selectedTrucks.size > 1 ? 's' : ''}
              </Badge>
              {selectedTrucks.size > 0 ? (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={deselectAll}>
                  Tout désélectionner
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>
                  Tout sélectionner
                </Button>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium capitalize">{headerLabel}</span>
              <Button variant="outline" size="sm" className="text-xs h-6" onClick={goToday}>
                Aujourd'hui
              </Button>
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar */}
          {shiftViewMode === 'month' ? renderMonthView() : renderWeekView()}

          {/* Shift controls */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type de décalage</Label>
              <Select value={shiftType} onValueChange={v => setShiftType(v as any)}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weeks">Semaines</SelectItem>
                  <SelectItem value="days">Jours</SelectItem>
                  <SelectItem value="hours">Heures</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valeur (+ ou -)</Label>
              <Input type="number" value={shiftValue} onChange={e => setShiftValue(e.target.value)} className="h-8 text-sm mt-1" placeholder="Ex: 1 ou -2" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleConfirm} disabled={selectedTrucks.size === 0 || !shiftValue || parseInt(shiftValue) === 0}>
            Décaler ({selectedTrucks.size} camion{selectedTrucks.size > 1 ? 's' : ''})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
