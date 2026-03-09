import { useState, useMemo } from 'react';
import { useDelivery } from '@/context/DeliveryContext';
import { BeamElement, Truck, PRODUCT_TYPES } from '@/types/delivery';
import { getTransportCategory, getTruckWeight, getCategoryColorClass, isNonStandard, isMultiSite, getTruckMaxLength, getTruckFactories } from '@/utils/transportUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, GripVertical, Truck as TruckIcon, Filter, X, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, isSameMonth, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import NewTruckModal from './NewTruckModal';
import TruckDetailModal from './TruckDetailModal';
import { TransportAlertModal, MultiSiteAlertModal } from './AlertModal';

export default function TruckCompositionTab() {
  const { elements, trucks, getTrucksForDate, getTruckElements, addTruck, addElementsToTruck, removeElementFromTruck, deleteTruck, isElementAssigned } = useDelivery();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterZone, setFilterZone] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFactory, setFilterFactory] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unloaded' | 'loaded'>('all');
  const [newTruckDate, setNewTruckDate] = useState('');
  const [showNewTruck, setShowNewTruck] = useState(false);
  const [showExistingPicker, setShowExistingPicker] = useState(false);
  const [existingTrucks, setExistingTrucks] = useState<Truck[]>([]);
  const [pendingElementIds, setPendingElementIds] = useState<string[]>([]);
  const [detailTruck, setDetailTruck] = useState<Truck | null>(null);
  const [alertTransport, setAlertTransport] = useState<{ category: any; weight: number; maxLen: number; callback: () => void } | null>(null);
  const [alertMultiSite, setAlertMultiSite] = useState<{ factories: string[]; callback: () => void } | null>(null);

  const zones = useMemo(() => [...new Set(elements.map(e => e.zone).filter(Boolean))], [elements]);
  const factories = useMemo(() => [...new Set(elements.map(e => e.factory).filter(Boolean))], [elements]);

  const filteredElements = useMemo(() => {
    return elements.filter(el => {
      if (filterZone && el.zone !== filterZone) return false;
      if (filterType && el.productType !== filterType) return false;
      if (filterFactory && el.factory !== filterFactory) return false;
      if (filterStatus === 'unloaded' && isElementAssigned(el.id)) return false;
      if (filterStatus === 'loaded' && !isElementAssigned(el.id)) return false;
      return true;
    });
  }, [elements, filterZone, filterType, filterFactory, filterStatus, isElementAssigned]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const unassigned = filteredElements.filter(el => !isElementAssigned(el.id));
    if (selectedIds.size === unassigned.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unassigned.map(el => el.id)));
    }
  };

  // Calendar logic
  const calendarDays = useMemo(() => {
    if (viewMode === 'month') {
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
  }, [currentDate, viewMode]);

  const navigate = (dir: number) => {
    setCurrentDate(prev => viewMode === 'month' ? (dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1)) : (dir > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1)));
  };

  const handleDrop = (dateStr: string) => {
    const ids = Array.from(selectedIds).filter(id => !isElementAssigned(id));
    if (ids.length === 0) return;
    const dayTrucks = getTrucksForDate(dateStr);
    setPendingElementIds(ids);
    setNewTruckDate(dateStr);
    if (dayTrucks.length === 0) {
      setShowNewTruck(true);
    } else {
      setExistingTrucks(dayTrucks);
      setShowExistingPicker(true);
    }
  };

  const checkAlertsAndAssign = (truckId: string, elementIds: string[]) => {
    const truck = trucks.find(t => t.id === truckId);
    if (!truck) return;
    const currentElements = getTruckElements(truckId);
    const newElements = elementIds.map(id => elements.find(e => e.id === id)!).filter(Boolean);
    const allElements = [...currentElements, ...newElements];

    const doAssign = () => {
      addElementsToTruck(truckId, elementIds);
      setSelectedIds(new Set());
    };

    if (isNonStandard(allElements)) {
      const cat = getTransportCategory(allElements);
      setAlertTransport({
        category: cat,
        weight: getTruckWeight(allElements),
        maxLen: getTruckMaxLength(allElements),
        callback: () => {
          setAlertTransport(null);
          if (isMultiSite(allElements)) {
            setAlertMultiSite({ factories: getTruckFactories(allElements), callback: () => { setAlertMultiSite(null); doAssign(); } });
          } else {
            doAssign();
          }
        }
      });
    } else if (isMultiSite(allElements)) {
      setAlertMultiSite({ factories: getTruckFactories(allElements), callback: () => { setAlertMultiSite(null); doAssign(); } });
    } else {
      doAssign();
    }
  };

  const handleNewTruckConfirm = (number: string, time: string) => {
    const truckId = crypto.randomUUID();
    const newTruck: Truck = { id: truckId, number, date: newTruckDate, time, elementIds: [] };
    addTruck(newTruck);
    setShowNewTruck(false);
    setTimeout(() => checkAlertsAndAssign(truckId, pendingElementIds), 50);
  };

  const handleExistingPick = (truckId: string) => {
    setShowExistingPicker(false);
    checkAlertsAndAssign(truckId, pendingElementIds);
  };

  const handleNewFromExisting = () => {
    setShowExistingPicker(false);
    setShowNewTruck(true);
  };

  const onDragStart = (e: React.DragEvent, elId: string) => {
    if (!selectedIds.has(elId)) {
      setSelectedIds(new Set([elId]));
    }
    e.dataTransfer.setData('text/plain', 'elements');
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDropOnDay = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
    handleDrop(dateStr);
  };

  const onDragEnter = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.add('drag-over');
  };

  const onDragLeave = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
  };

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="flex gap-4 h-[calc(100vh-12rem)]">
      {/* Left panel - element list */}
      <Card className="w-80 flex-shrink-0 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1">
            <Filter className="h-4 w-4 text-accent" /> Repères disponibles
          </CardTitle>
          <div className="space-y-2 mt-2">
            <Select value={filterZone} onValueChange={setFilterZone}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes les zones</SelectItem>
                {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les types</SelectItem>
                {PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterFactory} onValueChange={setFilterFactory}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Usine" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes les usines</SelectItem>
                {factories.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="unloaded">Non chargé</SelectItem>
                <SelectItem value="loaded">Chargé</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setFilterZone(''); setFilterType(''); setFilterFactory(''); setFilterStatus('all'); }}>
              <X className="h-3 w-3 mr-1" /> Réinitialiser filtres
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-2">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Checkbox checked={selectedIds.size > 0 && selectedIds.size === filteredElements.filter(e => !isElementAssigned(e.id)).length} onCheckedChange={selectAll} />
            <span className="text-xs text-muted-foreground">{selectedIds.size} sélectionné(s)</span>
          </div>
          <div className="space-y-1">
            {filteredElements.map(el => {
              const assigned = isElementAssigned(el.id);
              return (
                <div
                  key={el.id}
                  draggable={!assigned}
                  onDragStart={e => onDragStart(e, el.id)}
                  className={`flex items-center gap-2 p-2 rounded-md text-xs border transition-colors cursor-grab active:cursor-grabbing ${assigned ? 'bg-muted/50 opacity-60' : 'bg-card hover:bg-secondary/50'} ${selectedIds.has(el.id) ? 'border-accent ring-1 ring-accent/30' : 'border-transparent'}`}
                >
                  {!assigned && <Checkbox checked={selectedIds.has(el.id)} onCheckedChange={() => toggleSelect(el.id)} />}
                  {assigned && <Badge variant="outline" className="text-[10px] px-1">Chargé</Badge>}
                  <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-mono font-medium">{el.repere}</span>
                    <span className="text-muted-foreground ml-1">{el.productType}</span>
                    <div className="text-muted-foreground">{el.length}m · {el.weight}t · {el.zone}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Right panel - calendar */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="text-lg font-semibold capitalize min-w-[200px] text-center">
              {viewMode === 'month' ? format(currentDate, 'MMMM yyyy', { locale: fr }) : `Semaine ${format(currentDate, 'II')} – ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM', { locale: fr })} au ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM/yyyy', { locale: fr })}`}
            </h2>
            <Button variant="outline" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex gap-1">
            <Button variant={viewMode === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('month')}>Mois</Button>
            <Button variant={viewMode === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('week')}>Semaine</Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden flex-1">
          {dayNames.map(d => (
            <div key={d} className="bg-primary text-primary-foreground text-center text-xs font-medium py-2">{d}</div>
          ))}
          {calendarDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayTrucks = getTrucksForDate(dateStr);
            const inMonth = viewMode === 'month' ? isSameMonth(day, currentDate) : true;
            return (
              <div
                key={dateStr}
                onDragOver={onDragOver}
                onDrop={e => onDropOnDay(e, dateStr)}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onClick={() => selectedIds.size > 0 && handleDrop(dateStr)}
                className={`bg-card p-1 ${viewMode === 'week' ? 'min-h-[300px]' : 'min-h-[80px]'} ${!inMonth ? 'opacity-40' : ''} ${isToday(day) ? 'ring-2 ring-accent ring-inset' : ''} transition-colors cursor-pointer hover:bg-secondary/30`}
              >
                <div className={`text-xs font-medium mb-1 ${isToday(day) ? 'text-accent' : 'text-muted-foreground'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayTrucks.map(truck => {
                    const els = getTruckElements(truck.id);
                    const cat = getTransportCategory(els);
                    const weight = getTruckWeight(els);
                    return (
                      <div
                        key={truck.id}
                        onClick={e => { e.stopPropagation(); setDetailTruck(truck); }}
                        className={`truck-badge ${getCategoryColorClass(cat)} flex items-center gap-1`}
                      >
                        <TruckIcon className="h-3 w-3" />
                        <span className="truncate">{truck.number}</span>
                        <span className="ml-auto">{weight.toFixed(1)}t</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <NewTruckModal open={showNewTruck} onClose={() => setShowNewTruck(false)} onConfirm={handleNewTruckConfirm} date={newTruckDate} />

      <Dialog open={showExistingPicker} onOpenChange={v => !v && setShowExistingPicker(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choisir un camion – {newTruckDate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {existingTrucks.map(t => {
              const els = getTruckElements(t.id);
              const cat = getTransportCategory(els);
              return (
                <Button key={t.id} variant="outline" className="w-full justify-start gap-2" onClick={() => handleExistingPick(t.id)}>
                  <span className={`w-3 h-3 rounded-full ${getCategoryColorClass(cat)}`} />
                  {t.number} – {t.time} – {getTruckWeight(els).toFixed(1)}t
                </Button>
              );
            })}
            <Button className="w-full" onClick={handleNewFromExisting}>
              <TruckIcon className="h-4 w-4 mr-1" /> Créer un nouveau camion
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TruckDetailModal open={!!detailTruck} onClose={() => setDetailTruck(null)} truck={detailTruck} />

      {alertTransport && (
        <TransportAlertModal
          open
          category={alertTransport.category}
          totalWeight={alertTransport.weight}
          maxLength={alertTransport.maxLen}
          onContinue={alertTransport.callback}
          onCancel={() => setAlertTransport(null)}
        />
      )}

      {alertMultiSite && (
        <MultiSiteAlertModal
          open
          factories={alertMultiSite.factories}
          onContinue={alertMultiSite.callback}
          onCancel={() => setAlertMultiSite(null)}
        />
      )}
    </div>
  );
}
