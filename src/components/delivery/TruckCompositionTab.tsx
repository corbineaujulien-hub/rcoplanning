import React, { useState, useMemo, useCallback } from 'react';
import { useDelivery } from '@/context/DeliveryContext';
import { BeamElement, Truck, TRANSPORT_CATEGORIES, TransportCategory, Plan } from '@/types/delivery';
import { getTransportCategory, getTruckWeight, getCategoryColorClass, isNonStandard, isMultiSite, getTruckMaxLength, getTruckFactories, getProductCountsByType, getFactoryColor } from '@/utils/transportUtils';
import { isHoliday } from '@/utils/frenchHolidays';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, GripVertical, Truck as TruckIcon, Filter, X, Trash2, MessageSquare, Search, Weight, Ruler, Factory, Package, FileText, List, ArrowRightLeft, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, isSameMonth, isSameDay, isToday, getDay, addHours, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import NewTruckModal from './NewTruckModal';
import TruckDetailModal from './TruckDetailModal';
import { TransportAlertModal, MultiSiteAlertModal } from './AlertModal';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6);

export default function TruckCompositionTab() {
  const { elements, trucks, getTrucksForDate, getTruckElements, addTruck, addElementsToTruck, removeElementFromTruck, deleteTruck, deleteAllTrucks, updateTruck, isElementAssigned, plans, projectInfo, teams } = useDelivery();
  const hasMultipleTeams = teams.length > 1;
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Initialize selected team
  const activeTeamId = selectedTeamId || (teams.length > 0 ? teams[0].id : null);

  // Filter trucks by selected team when multiple teams exist
  const filteredTrucks = useMemo(() => {
    if (!hasMultipleTeams) return trucks;
    if (!activeTeamId) return trucks;
    return trucks.filter(t => t.teamId === activeTeamId);
  }, [trucks, hasMultipleTeams, activeTeamId]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [filterRepere, setFilterRepere] = useState('');
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
  const [draggedTruckIds, setDraggedTruckIds] = useState<string[]>([]);
  const [selectedTruckIds, setSelectedTruckIds] = useState<Set<string>>(new Set());
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [selectionMode, setSelectionMode] = useState<'list' | 'plans'>('list');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Plan filter states
  const [planFilterRepere, setPlanFilterRepere] = useState('');
  const [planFilterFactory, setPlanFilterFactory] = useState('');

  // Shift dialog states
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [shiftSelectedTrucks, setShiftSelectedTrucks] = useState<Set<string>>(new Set());
  const [shiftType, setShiftType] = useState<'weeks' | 'days' | 'hours'>('days');
  const [shiftValue, setShiftValue] = useState('');

  const showSaturdays = projectInfo.showSaturdays || false;

  const getElementTruck = (elementId: string): Truck | undefined => {
    return trucks.find(t => t.elementIds.includes(elementId));
  };

  // Helper: get trucks for a date, filtered by team if multi-team
  const getTeamTrucksForDate = useCallback((dateStr: string) => {
    const dayTrucks = getTrucksForDate(dateStr);
    if (!hasMultipleTeams || !activeTeamId) return dayTrucks;
    return dayTrucks.filter(t => t.teamId === activeTeamId);
  }, [getTrucksForDate, hasMultipleTeams, activeTeamId]);

  // State for drag highlight on day view trucks
  const [dragOverTruckId, setDragOverTruckId] = useState<string | null>(null);
  const [dragOverNewZone, setDragOverNewZone] = useState(false);

  const zones = useMemo(() => [...new Set(elements.map(e => e.zone).filter(Boolean))], [elements]);
  const factoryList = useMemo(() => [...new Set(elements.map(e => e.factory).filter(Boolean))], [elements]);
  const productTypes = useMemo(() => [...new Set(elements.map(e => e.productType).filter(Boolean))].sort(), [elements]);

  const filteredElements = useMemo(() => {
    return elements.filter(el => {
      if (filterRepere && !el.repere.toLowerCase().includes(filterRepere.toLowerCase())) return false;
      if (filterZone && filterZone !== '__all__' && el.zone !== filterZone) return false;
      if (filterType && filterType !== '__all__' && el.productType !== filterType) return false;
      if (filterFactory && filterFactory !== '__all__' && el.factory !== filterFactory) return false;
      if (filterStatus === 'unloaded' && isElementAssigned(el.id)) return false;
      if (filterStatus === 'loaded' && !isElementAssigned(el.id)) return false;
      return true;
    });
  }, [elements, filterRepere, filterZone, filterType, filterFactory, filterStatus, isElementAssigned]);

  const getPlanElements = (plan: Plan): BeamElement[] => {
    return elements.filter(el => {
      if (plan.zones.length > 0 && !plan.zones.includes(el.zone)) return false;
      if (plan.productTypes.length > 0 && !plan.productTypes.includes(el.productType)) return false;
      return true;
    });
  };

  const groupByType = (els: BeamElement[]): Record<string, BeamElement[]> => {
    const groups: Record<string, BeamElement[]> = {};
    els.forEach(el => {
      const type = el.productType || 'Autre';
      if (!groups[type]) groups[type] = [];
      groups[type].push(el);
    });
    return groups;
  };

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

  const toggleTruckSelect = (truckId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTruckIds(prev => {
      const next = new Set(prev);
      next.has(truckId) ? next.delete(truckId) : next.add(truckId);
      return next;
    });
  };

  // Filter weekend days based on settings
  const filterWeekendDays = (days: Date[]): Date[] => {
    return days.filter(day => {
      const dow = getDay(day);
      if (dow === 0) return false; // Always hide Sunday
      if (dow === 6 && !showSaturdays) return false; // Hide Saturday unless enabled
      return true;
    });
  };

  const calendarDays = useMemo(() => {
    if (viewMode === 'month') {
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    } else {
      return [currentDate];
    }
  }, [currentDate, viewMode]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Filtered days for month/week views (no weekends)
  const filteredCalendarDays = useMemo(() => filterWeekendDays(calendarDays), [calendarDays, showSaturdays]);
  const filteredWeekDays = useMemo(() => filterWeekendDays(weekDays), [weekDays, showSaturdays]);

  const dayNames = useMemo(() => {
    const all = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    if (showSaturdays) return all.slice(0, 6); // Mon-Sat
    return all.slice(0, 5); // Mon-Fri
  }, [showSaturdays]);

  const gridCols = showSaturdays ? 6 : 5;

  const navigate = (dir: number) => {
    setCurrentDate(prev => {
      if (viewMode === 'month') return dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1);
      if (viewMode === 'week') return dir > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1);
      return dir > 0 ? addDays(prev, 1) : subDays(prev, 1);
    });
  };

  const handleDrop = (dateStr: string) => {
    const ids = Array.from(selectedIds).filter(id => !isElementAssigned(id));
    if (ids.length === 0) return;
    const dayTrucks = getTeamTrucksForDate(dateStr);
    if (dayTrucks.length === 0) {
      setShowNewTruck(true);
    } else {
      setExistingTrucks(dayTrucks);
      setShowExistingPicker(true);
    }
  };

  const checkAlertsAndAssign = (truckId: string, elementIds: string[], truckElements?: BeamElement[]) => {
    const currentElements = truckElements || getTruckElements(truckId);
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
    const newTruck: Truck = { id: truckId, number, date: newTruckDate, time, elementIds: [...pendingElementIds], teamId: hasMultipleTeams ? activeTeamId || undefined : undefined };
    addTruck(newTruck);
    setShowNewTruck(false);

    const pendingEls = pendingElementIds.map(id => elements.find(e => e.id === id)!).filter(Boolean);
    if (isNonStandard(pendingEls)) {
      const cat = getTransportCategory(pendingEls);
      setAlertTransport({
        category: cat,
        weight: getTruckWeight(pendingEls),
        maxLen: getTruckMaxLength(pendingEls),
        callback: () => {
          setAlertTransport(null);
          if (isMultiSite(pendingEls)) {
            setAlertMultiSite({ factories: getTruckFactories(pendingEls), callback: () => { setAlertMultiSite(null); setSelectedIds(new Set()); } });
          } else {
            setSelectedIds(new Set());
          }
        }
      });
    } else if (isMultiSite(pendingEls)) {
      setAlertMultiSite({ factories: getTruckFactories(pendingEls), callback: () => { setAlertMultiSite(null); setSelectedIds(new Set()); } });
    } else {
      setSelectedIds(new Set());
    }
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

  const onTruckDragStart = (e: React.DragEvent, truckId: string) => {
    e.stopPropagation();
    const ids = selectedTruckIds.has(truckId) ? Array.from(selectedTruckIds) : [truckId];
    setDraggedTruckIds(ids);
    e.dataTransfer.setData('text/plain', 'trucks');
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDropOnDay = (e: React.DragEvent, dateStr: string, hour?: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
    const type = e.dataTransfer.getData('text/plain');
    if (type === 'trucks') {
      const isMultiple = draggedTruckIds.length > 1;
      draggedTruckIds.forEach(id => {
        const updates: Partial<Truck> = { date: dateStr };
        if (!isMultiple && hour !== undefined) {
          updates.time = `${String(hour).padStart(2, '0')}:00`;
        }
        updateTruck(id, updates);
      });
      setDraggedTruckIds([]);
      setSelectedTruckIds(new Set());
    } else {
      handleDrop(dateStr);
    }
  };

  const onDragEnter = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.add('drag-over');
  };

  const onDragLeave = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
  };

  // Shift trucks logic
  const handleShiftConfirm = () => {
    const val = parseInt(shiftValue, 10);
    if (isNaN(val) || val === 0 || shiftSelectedTrucks.size === 0) return;

    shiftSelectedTrucks.forEach(truckId => {
      const truck = trucks.find(t => t.id === truckId);
      if (!truck) return;

      const baseDate = parse(truck.date, 'yyyy-MM-dd', new Date());
      let newDate: Date;

      if (shiftType === 'weeks') {
        newDate = addWeeks(baseDate, val);
        updateTruck(truckId, { date: format(newDate, 'yyyy-MM-dd') });
      } else if (shiftType === 'days') {
        newDate = addDays(baseDate, val);
        updateTruck(truckId, { date: format(newDate, 'yyyy-MM-dd') });
      } else {
        // Hours: parse time and shift
        const [h, m] = truck.time.split(':').map(Number);
        const dateTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), h, m);
        const shifted = addHours(dateTime, val);
        updateTruck(truckId, {
          date: format(shifted, 'yyyy-MM-dd'),
          time: format(shifted, 'HH:mm'),
        });
      }
    });

    setShowShiftDialog(false);
    setShiftSelectedTrucks(new Set());
    setShiftValue('');
  };

  const recapData = useMemo(() => {
    const allFactories = new Set<string>();
    const data: Record<string, Record<TransportCategory | 'total', number>> = {};

    filteredTrucks.forEach(truck => {
      const els = getTruckElements(truck.id);
      const cat = getTransportCategory(els);
      const facs = getTruckFactories(els);
      if (facs.length === 0) facs.push('—');
      facs.forEach(f => {
        allFactories.add(f);
        if (!data[f]) data[f] = { standard: 0, cat1: 0, cat2: 0, cat3: 0, total: 0 };
        data[f][cat]++;
        data[f].total++;
      });
    });

    return { factories: [...allFactories].sort(), data };
  }, [trucks, getTruckElements]);

  const renderTruckBadge = (truck: Truck, showTime: boolean = false) => {
    const els = getTruckElements(truck.id);
    const cat = getTransportCategory(els);
    const weight = getTruckWeight(els);
    const isSelected = selectedTruckIds.has(truck.id);
    const isEmpty = els.length === 0;
    const hasComment = !!truck.comment?.trim();
    const colorClass = isEmpty ? 'bg-foreground text-background' : getCategoryColorClass(cat);
    return (
      <div
        key={truck.id}
        draggable
        onDragStart={e => onTruckDragStart(e, truck.id)}
        onClick={e => {
          if (e.ctrlKey || e.metaKey) {
            toggleTruckSelect(truck.id, e);
          } else {
            e.stopPropagation();
            setDetailTruck(truck);
          }
        }}
        className={`truck-badge ${colorClass} flex items-center gap-1 cursor-grab active:cursor-grabbing ${isSelected ? 'ring-2 ring-accent' : ''}`}
      >
        <TruckIcon className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{truck.number}</span>
        {hasComment && <MessageSquare className="h-3 w-3 flex-shrink-0 opacity-70" />}
        {showTime && <span className="text-[10px] opacity-80">{truck.time}</span>}
        <span className="ml-auto text-[10px]">{weight.toFixed(1)}t</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Team selector */}
      {hasMultipleTeams && (
        <div className="flex items-center gap-2 px-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            {teams.map(team => (
              <Button
                key={team.id}
                variant={activeTeamId === team.id ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => setSelectedTeamId(team.id)}
              >
                {team.name}
              </Button>
            ))}
          </div>
        </div>
      )}
      <div className={`flex ${selectionMode === 'plans' && selectedPlanId ? 'flex-col' : 'flex-row'} gap-4 ${selectionMode === 'plans' && selectedPlanId ? '' : 'h-[calc(100vh-16rem)]'}`}>
        {/* Left panel - element list or plans */}
        <Card className={`${selectionMode === 'plans' && selectedPlanId ? 'w-full' : 'w-80'} flex-shrink-0 flex flex-col`}>
          <CardHeader className="pb-2">
            {/* Toggle between list and plans */}
            <div className="flex gap-1 mb-2">
              <Button variant={selectionMode === 'list' ? 'default' : 'outline'} size="sm" className="flex-1 text-xs" onClick={() => setSelectionMode('list')}>
                <List className="h-3.5 w-3.5 mr-1" /> Liste
              </Button>
              <Button variant={selectionMode === 'plans' ? 'default' : 'outline'} size="sm" className="flex-1 text-xs" onClick={() => setSelectionMode('plans')} disabled={plans.length === 0}>
                <FileText className="h-3.5 w-3.5 mr-1" /> Plans ({plans.length})
              </Button>
            </div>

            {selectionMode === 'list' && (
              <>
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
                      {productTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterFactory} onValueChange={setFilterFactory}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Usine" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Toutes les usines</SelectItem>
                      {factoryList.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
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
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setFilterRepere(''); setFilterZone(''); setFilterType(''); setFilterFactory(''); setFilterStatus('all'); }}>
                    <X className="h-3 w-3 mr-1" /> Réinitialiser filtres
                  </Button>
                </div>
              </>
            )}

            {selectionMode === 'plans' && (
              <CardTitle className="text-sm flex items-center gap-1">
                <FileText className="h-4 w-4 text-accent" /> Sélection par plan
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-2">
            {selectionMode === 'list' ? (
              <>
                {/* Search above badges */}
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Rechercher repère…" value={filterRepere} onChange={e => setFilterRepere(e.target.value)} className="h-7 text-xs pl-7" />
                </div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Checkbox checked={selectedIds.size > 0 && selectedIds.size === filteredElements.filter(e => !isElementAssigned(e.id)).length} onCheckedChange={selectAll} />
                  <span className="text-xs text-muted-foreground">{selectedIds.size} sélectionné(s) / {filteredElements.length} repères</span>
                </div>
                {/* Badges grouped by product type */}
                <div className="space-y-3">
                  {Object.entries(groupByType(filteredElements)).sort(([a], [b]) => a.localeCompare(b)).map(([type, els]) => (
                    <div key={type}>
                      <div className="text-[11px] font-semibold text-muted-foreground mb-1 px-1">{type} ({els.length})</div>
                      <div className="flex flex-wrap gap-1">
                        {els.map(el => {
                          const assigned = isElementAssigned(el.id);
                          const selected = selectedIds.has(el.id);
                          return (
                            <div
                              key={el.id}
                              draggable={!assigned}
                              onDragStart={e => onDragStart(e, el.id)}
                              onClick={() => !assigned && toggleSelect(el.id)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono cursor-pointer border transition-colors ${
                                assigned
                                  ? 'bg-muted/50 opacity-50 cursor-default border-transparent'
                                  : selected
                                    ? 'bg-accent/20 border-accent ring-1 ring-accent/30'
                                    : 'bg-secondary/50 hover:bg-secondary border-transparent'
                              }`}
                            >
                              <span className="font-semibold">{el.repere}</span>
                              <span className="text-muted-foreground font-sans">{el.weight}t</span>
                              <span className="text-muted-foreground font-sans">{el.length}m</span>
                              {assigned && <span className="text-muted-foreground font-sans italic">Chargé · {getElementTruck(el.id)?.number}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* Plans mode */
              <div className="space-y-2">
                {!selectedPlanId ? (
                  /* Plan list */
                  plans.map(plan => {
                    const planEls = getPlanElements(plan);
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className="p-2 rounded-md border bg-card hover:bg-secondary/50 cursor-pointer transition-colors"
                      >
                        <div className="font-medium text-xs truncate">{plan.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {planEls.length} repère(s) · {plan.zones.join(', ')}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  /* Selected plan: PDF + badges grouped by type */
                  (() => {
                    const plan = plans.find(p => p.id === selectedPlanId);
                    if (!plan) return null;
                    let matchedElements = getPlanElements(plan);

                    // Apply plan-level filters
                    if (planFilterRepere) {
                      matchedElements = matchedElements.filter(el => el.repere.toLowerCase().includes(planFilterRepere.toLowerCase()));
                    }
                    if (planFilterFactory && planFilterFactory !== '__all__') {
                      matchedElements = matchedElements.filter(el => el.factory === planFilterFactory);
                    }

                    const unassignedMatched = matchedElements.filter(e => !isElementAssigned(e.id));
                    const grouped = groupByType(matchedElements);
                    const planFactories = [...new Set(getPlanElements(plan).map(e => e.factory).filter(Boolean))];

                    return (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSelectedPlanId(null); setPlanFilterRepere(''); setPlanFilterFactory(''); }}>
                            ← Retour
                          </Button>
                          <span className="text-xs font-medium truncate flex-1">{plan.name}</span>
                        </div>
                        {plan.pdfDataUrl && (
                          <iframe src={plan.pdfDataUrl} className="w-full h-[50vh] rounded border mb-2" title={plan.name} />
                        )}

                        {/* Filters for plan repères */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <div className="relative flex-1 min-w-[120px]">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="Rechercher repère…" value={planFilterRepere} onChange={e => setPlanFilterRepere(e.target.value)} className="h-7 text-xs pl-7" />
                          </div>
                          <Select value={planFilterFactory} onValueChange={setPlanFilterFactory}>
                            <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue placeholder="Usine" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">Toutes usines</SelectItem>
                              {planFactories.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {(planFilterRepere || (planFilterFactory && planFilterFactory !== '__all__')) && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => { setPlanFilterRepere(''); setPlanFilterFactory(''); }}>
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mb-2 px-1">
                          <Checkbox
                            checked={unassignedMatched.length > 0 && unassignedMatched.every(e => selectedIds.has(e.id))}
                            onCheckedChange={() => {
                              const allSelected = unassignedMatched.every(e => selectedIds.has(e.id));
                              if (allSelected) {
                                setSelectedIds(prev => { const next = new Set(prev); unassignedMatched.forEach(e => next.delete(e.id)); return next; });
                              } else {
                                setSelectedIds(prev => { const next = new Set(prev); unassignedMatched.forEach(e => next.add(e.id)); return next; });
                              }
                            }}
                          />
                          <span className="text-xs text-muted-foreground">{selectedIds.size} sélectionné(s) / {matchedElements.length} repères</span>
                        </div>
                        {/* Badges grouped by product type */}
                        <div className="space-y-3">
                          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([type, els]) => (
                            <div key={type}>
                              <div className="text-[11px] font-semibold text-muted-foreground mb-1 px-1">{type} ({els.length})</div>
                              <div className="flex flex-wrap gap-1">
                                {els.map(el => {
                                  const assigned = isElementAssigned(el.id);
                                  const selected = selectedIds.has(el.id);
                                  return (
                                    <div
                                      key={el.id}
                                      draggable={!assigned}
                                      onDragStart={e => onDragStart(e, el.id)}
                                      onClick={() => !assigned && toggleSelect(el.id)}
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono cursor-pointer border transition-colors ${
                                        assigned
                                          ? 'bg-muted/50 opacity-50 cursor-default border-transparent'
                                          : selected
                                            ? 'bg-accent/20 border-accent ring-1 ring-accent/30'
                                            : 'bg-secondary/50 hover:bg-secondary border-transparent'
                                      }`}
                                    >
                                      <span className="font-semibold">{el.repere}</span>
                                      <span className="text-muted-foreground font-sans">{el.weight}t</span>
                                      <span className="text-muted-foreground font-sans">{el.length}m</span>
                                      {assigned && <span className="text-muted-foreground font-sans italic">Chargé · {getElementTruck(el.id)?.number}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()
                )}
              </div>
            )}
          </CardContent>
        </Card>


        {/* Right panel - calendar */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <h2 className="text-lg font-semibold capitalize min-w-[200px] text-center">
                {viewMode === 'month' ? format(currentDate, 'MMMM yyyy', { locale: fr }) : viewMode === 'week' ? `Semaine ${format(currentDate, 'II')} – ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM', { locale: fr })} au ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM/yyyy', { locale: fr })}` : format(currentDate, 'EEEE dd MMMM yyyy', { locale: fr })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="flex gap-1">
              <Button variant={viewMode === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('month')}>Mois</Button>
              <Button variant={viewMode === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('week')}>Semaine</Button>
              <Button variant={viewMode === 'day' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('day')}>Jour</Button>
              {trucks.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={() => { setShiftSelectedTrucks(new Set()); setShiftValue(''); setShowShiftDialog(true); }}>
                    <ArrowRightLeft className="h-4 w-4 mr-1" /> Décaler
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteAll(true)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Supprimer tout
                  </Button>
                </>
              )}
            </div>
          </div>

          {viewMode === 'month' ? (
            <div className={`grid gap-px bg-border rounded-lg overflow-hidden flex-1`} style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
              {dayNames.map(d => (
                <div key={d} className="bg-primary text-primary-foreground text-center text-xs font-medium py-2">{d}</div>
              ))}
              {filteredCalendarDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayTrucks = getTeamTrucksForDate(dateStr);
                const inMonth = isSameMonth(day, currentDate);
                const holiday = isHoliday(dateStr);
                return (
                  <div
                    key={dateStr}
                    onDragOver={onDragOver}
                    onDrop={e => onDropOnDay(e, dateStr)}
                    onDragEnter={onDragEnter}
                    onDragLeave={onDragLeave}
                    onClick={() => selectedIds.size > 0 && handleDrop(dateStr)}
                    className={`bg-card p-1 min-h-[80px] ${!inMonth ? 'opacity-40' : ''} ${isToday(day) ? 'ring-2 ring-accent ring-inset' : ''} ${holiday ? 'bg-muted/60' : ''} transition-colors cursor-pointer hover:bg-secondary/30`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday(day) ? 'text-accent' : holiday ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                      {format(day, 'd')}
                      {holiday && <span className="ml-1 text-[9px] italic">férié</span>}
                    </div>
                    <div className="space-y-1">
                      {dayTrucks.map(truck => renderTruckBadge(truck, true))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'week' ? (
            <div className="flex-1 overflow-auto border rounded-lg">
              <div className="gap-px bg-border min-w-[700px]" style={{ display: 'grid', gridTemplateColumns: `60px repeat(${gridCols}, 1fr)` }}>
                <div className="bg-muted p-1 text-center text-xs font-medium">Heure</div>
                {filteredWeekDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const holiday = isHoliday(dateStr);
                  return (
                    <div key={dateStr} className={`bg-primary text-primary-foreground text-center text-xs font-medium py-2 ${isToday(day) ? 'ring-2 ring-accent ring-inset' : ''} ${holiday ? 'opacity-70' : ''}`}>
                      {format(day, 'EEE dd/MM', { locale: fr })}
                      {holiday && <span className="block text-[9px] italic opacity-80">férié</span>}
                    </div>
                  );
                })}
                {HOURS.map(hour => (
                  <React.Fragment key={`row-${hour}`}>
                    <div className="bg-muted p-1 text-center text-xs text-muted-foreground border-t border-border">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                    {filteredWeekDays.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const holiday = isHoliday(dateStr);
                      const hourTrucks = getTeamTrucksForDate(dateStr).filter(t => {
                        const h = parseInt(t.time.split(':')[0], 10);
                        return h === hour;
                      });
                      return (
                        <div
                          key={`${dateStr}-${hour}`}
                          onDragOver={onDragOver}
                          onDrop={e => onDropOnDay(e, dateStr, hour)}
                          onDragEnter={onDragEnter}
                          onDragLeave={onDragLeave}
                          onClick={() => selectedIds.size > 0 && handleDrop(dateStr)}
                          className={`bg-card p-0.5 min-h-[40px] border-t border-border transition-colors hover:bg-secondary/30 ${holiday ? 'bg-muted/40' : ''}`}
                        >
                          {hourTrucks.map(truck => renderTruckBadge(truck))}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto space-y-3">
              {(() => {
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                const dayTrucks = getTeamTrucksForDate(dateStr);
                if (dayTrucks.length === 0) {
                  return (
                    <div
                      onDragOver={onDragOver}
                      onDrop={e => onDropOnDay(e, dateStr)}
                      onDragEnter={onDragEnter}
                      onDragLeave={onDragLeave}
                      onClick={() => selectedIds.size > 0 && handleDrop(dateStr)}
                      className="flex items-center justify-center h-40 border-2 border-dashed border-border rounded-lg text-muted-foreground text-sm cursor-pointer hover:bg-secondary/30"
                    >
                      Aucun camion – glissez des repères ici pour créer un camion
                    </div>
                  );
                }
                return (
                  <>
                    {dayTrucks.map(truck => {
                      const els = getTruckElements(truck.id);
                      const cat = getTransportCategory(els);
                      const catInfo = TRANSPORT_CATEGORIES[cat];
                      const weight = getTruckWeight(els);
                      const maxLen = getTruckMaxLength(els);
                      const factories = getTruckFactories(els);
                      const counts = getProductCountsByType(els);
                      const isEmpty = els.length === 0;
                      return (
                        <Card
                          key={truck.id}
                          draggable
                          onDragStart={e => onTruckDragStart(e, truck.id)}
                          onDragOver={onDragOver}
                          onDragEnter={e => { e.preventDefault(); setDragOverTruckId(truck.id); }}
                          onDragLeave={() => setDragOverTruckId(null)}
                          onDrop={e => {
                            e.preventDefault();
                            setDragOverTruckId(null);
                            const type = e.dataTransfer.getData('text/plain');
                            if (type === 'trucks') {
                              onDropOnDay(e, dateStr);
                              return;
                            }
                            const ids = Array.from(selectedIds).filter(id => !isElementAssigned(id));
                            if (ids.length === 0) return;
                            checkAlertsAndAssign(truck.id, ids);
                          }}
                          onClick={() => setDetailTruck(truck)}
                          className={`cursor-pointer border-l-4 transition-all ${dragOverTruckId === truck.id ? 'ring-2 ring-accent bg-accent/5' : ''} ${isEmpty ? 'border-l-foreground' : cat === 'standard' ? 'border-l-transport-standard' : cat === 'cat1' ? 'border-l-transport-cat1' : cat === 'cat2' ? 'border-l-transport-cat2' : 'border-l-transport-cat3'}`}
                        >
                          <CardContent className="pt-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <TruckIcon className="h-5 w-5 text-accent" />
                                <span className="font-semibold text-lg">{truck.number}</span>
                                <span className={`${getCategoryColorClass(cat)} px-2 py-0.5 rounded text-xs font-medium`}>{catInfo.label}</span>
                              </div>
                              <span className="text-sm text-muted-foreground">{truck.time}</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div className="flex items-center gap-1"><Factory className="h-4 w-4 text-muted-foreground" />{factories.length > 0 ? factories.map(f => <span key={f} className="text-white text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: getFactoryColor(f) }}>{f}</span>) : <span>—</span>}</div>
                              <div className="flex items-center gap-1"><Weight className="h-4 w-4 text-muted-foreground" /><span>{weight.toFixed(2)} t</span></div>
                              <div className="flex items-center gap-1"><Ruler className="h-4 w-4 text-muted-foreground" /><span>{maxLen.toFixed(2)} m</span></div>
                              <div className="flex items-center gap-1"><Package className="h-4 w-4 text-muted-foreground" /><span>{els.length} produits</span></div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(counts).map(([type, count]) => (
                                <span key={type} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs">{count}× {type}</span>
                              ))}
                            </div>
                            <div className="space-y-1">
                              {Object.entries(
                                els.reduce<Record<string, typeof els>>((acc, el) => {
                                  (acc[el.productType] = acc[el.productType] || []).push(el);
                                  return acc;
                                }, {})
                              ).map(([type, typeEls]) => (
                                <div key={type}>
                                  <p className="text-xs font-semibold text-muted-foreground">{type}</p>
                                  <div className="flex flex-wrap gap-1">
                                    {typeEls.map(el => (
                                      <span key={el.id} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-mono flex items-center gap-0.5">
                                        {el.repere}
                                        <button
                                          onClick={(e) => { e.stopPropagation(); removeElementFromTruck(truck.id, el.id); }}
                                          className="hover:text-destructive transition-colors"
                                          title="Retirer du camion"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {truck.comment?.trim() && (
                              <div className="flex items-start gap-1.5 text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-md p-2">
                                <MessageSquare className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                <span>{truck.comment}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                    {/* Drop zone for new truck */}
                    <div
                      onDragOver={onDragOver}
                      onDragEnter={e => { e.preventDefault(); setDragOverNewZone(true); }}
                      onDragLeave={() => setDragOverNewZone(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setDragOverNewZone(false);
                        const type = e.dataTransfer.getData('text/plain');
                        if (type === 'trucks') return;
                        const ids = Array.from(selectedIds).filter(id => !isElementAssigned(id));
                        if (ids.length === 0) return;
                        setPendingElementIds(ids);
                        setNewTruckDate(dateStr);
                        setShowNewTruck(true);
                      }}
                      className={`flex items-center justify-center h-20 border-2 border-dashed rounded-lg text-muted-foreground text-sm cursor-pointer hover:bg-secondary/30 transition-all ${dragOverNewZone ? 'border-accent bg-accent/5 text-accent' : 'border-border'}`}
                    >
                      <TruckIcon className="h-4 w-4 mr-2" />
                      Glissez ici pour créer un nouveau camion
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Recap by factory × category */}
      {trucks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Récapitulatif par usine et catégorie de transport</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usine</TableHead>
                  {Object.values(TRANSPORT_CATEGORIES).map(c => (
                    <TableHead key={c.category} className="text-center">{c.label}</TableHead>
                  ))}
                  <TableHead className="text-center font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recapData.factories.map(factory => (
                  <TableRow key={factory}>
                    <TableCell className="font-medium">{factory}</TableCell>
                    {(['standard', 'cat1', 'cat2', 'cat3'] as TransportCategory[]).map(cat => (
                      <TableCell key={cat} className="text-center">
                        {recapData.data[factory]?.[cat] || 0}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold">{recapData.data[factory]?.total || 0}</TableCell>
                  </TableRow>
                ))}
                {recapData.factories.length > 1 && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    {(['standard', 'cat1', 'cat2', 'cat3'] as TransportCategory[]).map(cat => (
                      <TableCell key={cat} className="text-center">
                        {recapData.factories.reduce((sum, f) => sum + (recapData.data[f]?.[cat] || 0), 0)}
                      </TableCell>
                    ))}
                    <TableCell className="text-center">{trucks.length}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <NewTruckModal open={showNewTruck} onClose={() => setShowNewTruck(false)} onConfirm={handleNewTruckConfirm} date={newTruckDate} trucks={trucks} />

      <Dialog open={showExistingPicker} onOpenChange={v => !v && setShowExistingPicker(false)}>
        <DialogContent className="w-fit">
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

      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer toutes les compositions ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les camions seront supprimés et tous les repères redeviendront disponibles. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteAllTrucks(); setConfirmDeleteAll(false); }}>Supprimer tout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shift Dialog */}
      <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Décaler des camions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Sélectionner les camions</Label>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                if (shiftSelectedTrucks.size === trucks.length) {
                  setShiftSelectedTrucks(new Set());
                } else {
                  setShiftSelectedTrucks(new Set(trucks.map(t => t.id)));
                }
              }}>
                {shiftSelectedTrucks.size === trucks.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </Button>
            </div>
            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              {trucks.map(truck => {
                const els = getTruckElements(truck.id);
                const cat = getTransportCategory(els);
                return (
                  <label key={truck.id} className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-secondary/50 transition-colors">
                    <Checkbox
                      checked={shiftSelectedTrucks.has(truck.id)}
                      onCheckedChange={() => {
                        setShiftSelectedTrucks(prev => {
                          const next = new Set(prev);
                          next.has(truck.id) ? next.delete(truck.id) : next.add(truck.id);
                          return next;
                        });
                      }}
                    />
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${els.length === 0 ? 'bg-foreground' : getCategoryColorClass(cat)}`} />
                    <span className="text-sm font-medium">{truck.number}</span>
                    <span className="text-xs text-muted-foreground">{truck.date} · {truck.time}</span>
                  </label>
                );
              })}
            </div>
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
            <Button variant="outline" onClick={() => setShowShiftDialog(false)}>Annuler</Button>
            <Button onClick={handleShiftConfirm} disabled={shiftSelectedTrucks.size === 0 || !shiftValue || parseInt(shiftValue) === 0}>
              Décaler ({shiftSelectedTrucks.size} camion{shiftSelectedTrucks.size > 1 ? 's' : ''})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
