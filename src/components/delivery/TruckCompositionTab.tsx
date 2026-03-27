import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useDelivery } from '@/context/DeliveryContext';
import { BeamElement, Truck, TRANSPORT_CATEGORIES, TransportCategory, Plan } from '@/types/delivery';
import { getTransportCategory, getTruckWeight, getCategoryColorClass, isNonStandard, isMultiSite, getTruckMaxLength, getTruckFactories, getTruckZones, getProductCountsByType, getFactoryColor } from '@/utils/transportUtils';
import { isHoliday } from '@/utils/frenchHolidays';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronLeft, ChevronRight, ChevronDown, GripVertical, Truck as TruckIcon, Filter, X, Trash2, MessageSquare, Search, Weight, Ruler, Factory, Package, FileText, List, ArrowRightLeft, Users, MapPin } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, isSameMonth, isSameDay, isToday, getDay, addHours, parse, getISOWeek } from 'date-fns';
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
  const [filterZone, setFilterZone] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<Set<string>>(new Set());
  const [filterFactory, setFilterFactory] = useState<Set<string>>(new Set());
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
  const [calendarFactoryFilter, setCalendarFactoryFilter] = useState<Set<string>>(new Set());
  const [calendarTransporterFilter, setCalendarTransporterFilter] = useState<Set<string>>(new Set());

  // Plan filter states
  const [planFilterRepere, setPlanFilterRepere] = useState('');
  const [planFilterFactory, setPlanFilterFactory] = useState('');

  // Shift dialog states
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [shiftSelectedTrucks, setShiftSelectedTrucks] = useState<Set<string>>(new Set());
  const [shiftType, setShiftType] = useState<'weeks' | 'days' | 'hours'>('days');
  const [shiftValue, setShiftValue] = useState('');

  // Bulk reassignment dialog
  const [showBulkReassign, setShowBulkReassign] = useState(false);
  const [bulkSelectedTrucks, setBulkSelectedTrucks] = useState<Set<string>>(new Set());
  const [bulkTargetTeam, setBulkTargetTeam] = useState<string>('');

  const showSaturdays = projectInfo.showSaturdays || false;

  const getElementTruck = (elementId: string): Truck | undefined => {
    return trucks.find(t => t.elementIds.includes(elementId));
  };

  // All factories present in trucks (for calendar factory filter)
  const truckFactoryList = useMemo(() => {
    const facs = new Set<string>();
    trucks.forEach(t => {
      const els = getTruckElements(t.id);
      getTruckFactories(els).forEach(f => facs.add(f));
    });
    return [...facs].sort();
  }, [trucks, getTruckElements]);

  // All transporters present in trucks (for calendar transporter filter)
  const truckTransporterList = useMemo(() => {
    const transporters = new Set<string>();
    let hasEmpty = false;
    trucks.forEach(t => {
      if (t.transporter?.trim()) transporters.add(t.transporter.trim());
      else hasEmpty = true;
    });
    return { list: [...transporters].sort(), hasEmpty };
  }, [trucks]);

  // Helper: does a truck pass the calendar factory filter?
  const truckPassesFactoryFilter = useCallback((truckId: string): boolean => {
    if (calendarFactoryFilter.size === 0) return true;
    const els = getTruckElements(truckId);
    const facs = getTruckFactories(els);
    return facs.some(f => calendarFactoryFilter.has(f));
  }, [calendarFactoryFilter, getTruckElements]);

  // Helper: does a truck pass the calendar transporter filter?
  const truckPassesTransporterFilter = useCallback((truck: Truck): boolean => {
    if (calendarTransporterFilter.size === 0) return true;
    const transporter = truck.transporter?.trim() || '';
    if (transporter === '') return calendarTransporterFilter.has('__sans_transporteur__');
    return calendarTransporterFilter.has(transporter);
  }, [calendarTransporterFilter]);

  // Helper: get trucks for a date, filtered by team if multi-team, by factory and by transporter
  const getTeamTrucksForDate = useCallback((dateStr: string) => {
    let dayTrucks = getTrucksForDate(dateStr);
    if (hasMultipleTeams && activeTeamId) dayTrucks = dayTrucks.filter(t => t.teamId === activeTeamId);
    if (calendarFactoryFilter.size > 0) dayTrucks = dayTrucks.filter(t => truckPassesFactoryFilter(t.id));
    if (calendarTransporterFilter.size > 0) dayTrucks = dayTrucks.filter(t => truckPassesTransporterFilter(t));
    return dayTrucks;
  }, [getTrucksForDate, hasMultipleTeams, activeTeamId, calendarFactoryFilter, truckPassesFactoryFilter, calendarTransporterFilter, truckPassesTransporterFilter]);

  // State for drag highlight on day view trucks
  const [dragOverTruckId, setDragOverTruckId] = useState<string | null>(null);
  const [dragOverNewZone, setDragOverNewZone] = useState(false);

  const zones = useMemo(() => [...new Set(elements.map(e => e.zone).filter(Boolean))], [elements]);
  const factoryList = useMemo(() => [...new Set(elements.map(e => e.factory).filter(Boolean))], [elements]);
  const productTypes = useMemo(() => [...new Set(elements.map(e => e.productType).filter(Boolean))].sort(), [elements]);

  const filteredElements = useMemo(() => {
    return elements.filter(el => {
      if (filterRepere && !el.repere.toLowerCase().includes(filterRepere.toLowerCase())) return false;
      if (filterZone.size > 0 && !filterZone.has(el.zone)) return false;
      if (filterType.size > 0 && !filterType.has(el.productType)) return false;
      if (filterFactory.size > 0 && !filterFactory.has(el.factory)) return false;
      if (filterStatus === 'unloaded' && isElementAssigned(el.id)) return false;
      if (filterStatus === 'loaded' && !isElementAssigned(el.id)) return false;
      return true;
    });
  }, [elements, filterRepere, filterZone, filterType, filterFactory, filterStatus, isElementAssigned]);

  const hasAnyFilter = filterZone.size > 0 || filterType.size > 0 || filterFactory.size > 0 || filterStatus !== 'all';

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
      // Day view: skip Sundays always, Saturdays if disabled
      let next = dir > 0 ? addDays(prev, 1) : subDays(prev, 1);
      while (getDay(next) === 0 || (getDay(next) === 6 && !showSaturdays)) {
        next = dir > 0 ? addDays(next, 1) : subDays(next, 1);
      }
      return next;
    });
  };

  const handleDrop = (dateStr: string) => {
    const ids = Array.from(selectedIds).filter(id => !isElementAssigned(id));
    if (ids.length === 0) return;
    const dayTrucks = getTeamTrucksForDate(dateStr);
    setPendingElementIds(ids);
    setNewTruckDate(dateStr);
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
    const counts = getProductCountsByType(els);
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
        className={`truck-badge ${colorClass} flex flex-col gap-0.5 cursor-grab active:cursor-grabbing ${isSelected ? 'ring-2 ring-accent' : ''}`}
      >
        <div className="flex items-center gap-1">
          <TruckIcon className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{truck.number}</span>
          {hasComment && <MessageSquare className="h-3 w-3 flex-shrink-0 opacity-70" />}
          {showTime && <span className="text-[10px] opacity-80">{truck.time}</span>}
          <span className="ml-auto text-[10px]">{weight.toFixed(1)}t</span>
        </div>
        {Object.keys(counts).length > 0 && (
          <div className="text-[9px] opacity-80 pl-4 truncate">
            {Object.entries(counts).map(([type, count]) => `${type} (${count})`).join(', ')}
          </div>
        )}
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
          <CardHeader className="pb-1">
            {/* Toggle between list and plans */}
            <div className="flex gap-1 mb-1">
              <Button variant={selectionMode === 'list' ? 'default' : 'outline'} size="sm" className="flex-1 text-xs" onClick={() => setSelectionMode('list')}>
                <List className="h-3.5 w-3.5 mr-1" /> Liste
              </Button>
              <Button variant={selectionMode === 'plans' ? 'default' : 'outline'} size="sm" className="flex-1 text-xs" onClick={() => setSelectionMode('plans')} disabled={plans.length === 0}>
                <FileText className="h-3.5 w-3.5 mr-1" /> Plans ({plans.length})
              </Button>
            </div>

            {selectionMode === 'list' && (
              <>
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-7 px-2">
                      <span className="flex items-center gap-1"><Filter className="h-3 w-3" /> Filtres {hasAnyFilter ? `(${[filterZone.size, filterType.size, filterFactory.size, filterStatus !== 'all' ? 1 : 0].reduce((a, b) => a + b, 0)} actif${[filterZone.size, filterType.size, filterFactory.size, filterStatus !== 'all' ? 1 : 0].reduce((a, b) => a + b, 0) > 1 ? 's' : ''})` : ''}</span>
                      <ChevronDown className="h-3 w-3 transition-transform" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-1.5 mt-1.5">
                      <div className="grid grid-cols-2 gap-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={`h-7 text-[11px] justify-start ${filterZone.size > 0 ? 'border-primary text-primary' : ''}`}>
                              {filterZone.size > 0 ? `Zone (${filterZone.size})` : 'Zone'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 max-h-64 overflow-auto p-2" align="start">
                            <div className="space-y-1">
                              {zones.map(z => (
                                <label key={z} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                                  <Checkbox checked={filterZone.has(z)} onCheckedChange={() => setFilterZone(prev => { const next = new Set(prev); next.has(z) ? next.delete(z) : next.add(z); return next; })} />
                                  <span className="truncate">{z || '(vide)'}</span>
                                </label>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={`h-7 text-[11px] justify-start ${filterType.size > 0 ? 'border-primary text-primary' : ''}`}>
                              {filterType.size > 0 ? `Type (${filterType.size})` : 'Type'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 max-h-64 overflow-auto p-2" align="start">
                            <div className="space-y-1">
                              {productTypes.map(t => (
                                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                                  <Checkbox checked={filterType.has(t)} onCheckedChange={() => setFilterType(prev => { const next = new Set(prev); next.has(t) ? next.delete(t) : next.add(t); return next; })} />
                                  <span className="truncate">{t}</span>
                                </label>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={`h-7 text-[11px] justify-start ${filterFactory.size > 0 ? 'border-primary text-primary' : ''}`}>
                              {filterFactory.size > 0 ? `Usine (${filterFactory.size})` : 'Usine'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 max-h-64 overflow-auto p-2" align="start">
                            <div className="space-y-1">
                              {factoryList.map(f => (
                                <label key={f} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                                  <Checkbox checked={filterFactory.has(f)} onCheckedChange={() => setFilterFactory(prev => { const next = new Set(prev); next.has(f) ? next.delete(f) : next.add(f); return next; })} />
                                  <span className="truncate">{f}</span>
                                </label>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
                          <SelectTrigger className={`h-7 text-[11px] ${filterStatus !== 'all' ? 'border-primary text-primary' : ''}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tous</SelectItem>
                            <SelectItem value="unloaded">Non chargé</SelectItem>
                            <SelectItem value="loaded">Chargé</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {hasAnyFilter && (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full text-xs h-6"
                          onClick={() => { setFilterRepere(''); setFilterZone(new Set()); setFilterType(new Set()); setFilterFactory(new Set()); setFilterStatus('all'); }}
                        >
                          <X className="h-3 w-3 mr-1" /> Réinitialiser
                        </Button>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Sticky search + selection info */}
                <div className="relative mt-1.5">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Rechercher repère…" value={filterRepere} onChange={e => setFilterRepere(e.target.value)} className="h-7 text-xs pl-7" />
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                  <Checkbox checked={selectedIds.size > 0 && selectedIds.size === filteredElements.filter(e => !isElementAssigned(e.id)).length} onCheckedChange={selectAll} />
                  <span className="text-xs text-muted-foreground">{selectedIds.size} sélectionné(s) / {filteredElements.length}</span>
                </div>
                {selectedIds.size > 0 && (() => {
                  const selEls = elements.filter(e => selectedIds.has(e.id));
                  const selWeight = selEls.reduce((s, e) => s + e.weight, 0);
                  const selMaxLen = selEls.length > 0 ? Math.max(...selEls.map(e => e.length)) : 0;
                  const selCat = getTransportCategory(selEls);
                  const selCatInfo = TRANSPORT_CATEGORIES[selCat];
                  return (
                    <div className="flex flex-wrap items-center gap-1 mt-1 px-1">
                      <Badge variant="secondary" className="text-[10px]"><Weight className="h-3 w-3 mr-0.5" />{selWeight.toFixed(2)} t</Badge>
                      <Badge variant="secondary" className="text-[10px]"><Ruler className="h-3 w-3 mr-0.5" />{selMaxLen.toFixed(2)} m</Badge>
                      <Badge className={`text-[10px] ${getCategoryColorClass(selCat)}`}>{selCatInfo.label}</Badge>
                    </div>
                  );
                })()}
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
                        {selectedIds.size > 0 && (() => {
                          const selEls = elements.filter(e => selectedIds.has(e.id));
                          const selWeight = selEls.reduce((s, e) => s + e.weight, 0);
                          const selMaxLen = selEls.length > 0 ? Math.max(...selEls.map(e => e.length)) : 0;
                          const selCat = getTransportCategory(selEls);
                          const selCatInfo = TRANSPORT_CATEGORIES[selCat];
                          return (
                            <div className="flex flex-wrap items-center gap-1.5 mb-2 px-1">
                              <Badge variant="secondary" className="text-[10px]"><Weight className="h-3 w-3 mr-0.5" />{selWeight.toFixed(2)} t</Badge>
                              <Badge variant="secondary" className="text-[10px]"><Ruler className="h-3 w-3 mr-0.5" />{selMaxLen.toFixed(2)} m</Badge>
                              <Badge className={`text-[10px] ${getCategoryColorClass(selCat)}`}>{selCatInfo.label}</Badge>
                            </div>
                          );
                        })()}
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
              <Button variant={viewMode === 'day' ? 'default' : 'outline'} size="sm" onClick={() => {
                // Smart day selection: find first day with trucks in current view
                if (viewMode === 'month') {
                  const monthStart = startOfMonth(currentDate);
                  const monthEnd = endOfMonth(currentDate);
                  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
                  const firstDayWithTrucks = monthDays.find(d => getTeamTrucksForDate(format(d, 'yyyy-MM-dd')).length > 0);
                  if (firstDayWithTrucks) setCurrentDate(firstDayWithTrucks);
                } else if (viewMode === 'week') {
                  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
                  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
                  const weekDaysRange = eachDayOfInterval({ start: weekStart, end: weekEnd });
                  const firstDayWithTrucks = weekDaysRange.find(d => getTeamTrucksForDate(format(d, 'yyyy-MM-dd')).length > 0);
                  if (firstDayWithTrucks) setCurrentDate(firstDayWithTrucks);
                }
                setViewMode('day');
              }}>Jour</Button>
              {truckFactoryList.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={calendarFactoryFilter.size > 0 ? 'default' : 'outline'} size="sm">
                      <Factory className="h-4 w-4 mr-1" /> {calendarFactoryFilter.size > 0 ? `Usine (${calendarFactoryFilter.size})` : 'Usine'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 max-h-64 overflow-auto p-2" align="end">
                    <div className="space-y-1">
                      {truckFactoryList.map(f => (
                        <label key={f} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                          <Checkbox checked={calendarFactoryFilter.has(f)} onCheckedChange={() => setCalendarFactoryFilter(prev => { const next = new Set(prev); next.has(f) ? next.delete(f) : next.add(f); return next; })} />
                          <span className="text-white text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: getFactoryColor(f) }}>{f}</span>
                        </label>
                      ))}
                    </div>
                    {calendarFactoryFilter.size > 0 && (
                      <Button variant="default" size="sm" className="w-full text-xs h-6 mt-2" onClick={() => setCalendarFactoryFilter(new Set())}>
                        <X className="h-3 w-3 mr-1" /> Réinitialiser
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              )}
              {(truckTransporterList.list.length > 0 || truckTransporterList.hasEmpty) && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={calendarTransporterFilter.size > 0 ? 'default' : 'outline'} size="sm">
                      <TruckIcon className="h-4 w-4 mr-1" /> {calendarTransporterFilter.size > 0 ? `Transporteur (${calendarTransporterFilter.size})` : 'Transporteur'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 max-h-64 overflow-auto p-2" align="end">
                    <div className="space-y-1">
                      {truckTransporterList.hasEmpty && (
                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                          <Checkbox checked={calendarTransporterFilter.has('__sans_transporteur__')} onCheckedChange={() => setCalendarTransporterFilter(prev => { const next = new Set(prev); next.has('__sans_transporteur__') ? next.delete('__sans_transporteur__') : next.add('__sans_transporteur__'); return next; })} />
                          <span className="text-xs italic text-muted-foreground">Sans transporteur</span>
                        </label>
                      )}
                      {truckTransporterList.list.map(t => (
                        <label key={t} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                          <Checkbox checked={calendarTransporterFilter.has(t)} onCheckedChange={() => setCalendarTransporterFilter(prev => { const next = new Set(prev); next.has(t) ? next.delete(t) : next.add(t); return next; })} />
                          <span className="text-xs font-medium text-orange-500">{t}</span>
                        </label>
                      ))}
                    </div>
                    {calendarTransporterFilter.size > 0 && (
                      <Button variant="default" size="sm" className="w-full text-xs h-6 mt-2" onClick={() => setCalendarTransporterFilter(new Set())}>
                        <X className="h-3 w-3 mr-1" /> Réinitialiser
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              )}
              {trucks.length > 0 && (
                <>
                  {hasMultipleTeams && (
                    <Button variant="outline" size="sm" onClick={() => { setBulkSelectedTrucks(new Set()); setBulkTargetTeam(''); setShowBulkReassign(true); }}>
                      <Users className="h-4 w-4 mr-1" /> Réaffecter
                    </Button>
                  )}
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
            <div className="flex-1 overflow-auto">
            <div className={`grid gap-px bg-border rounded-lg overflow-hidden`} style={{ gridTemplateColumns: `40px repeat(${gridCols}, 1fr)` }}>
              {/* Week number header */}
              <div className="bg-muted text-muted-foreground text-center text-xs font-medium py-2">Sem.</div>
              {dayNames.map(d => (
                <div key={d} className="bg-primary text-primary-foreground text-center text-xs font-medium py-2">{d}</div>
              ))}
              {/* Group days by week and render with week number */}
              {(() => {
                const weeks: Date[][] = [];
                for (let i = 0; i < filteredCalendarDays.length; i += gridCols) {
                  weeks.push(filteredCalendarDays.slice(i, i + gridCols));
                }
                return weeks.map((weekDaysGroup, wi) => {
                  const weekNum = getISOWeek(weekDaysGroup[0]);
                  return (
                    <React.Fragment key={`week-${wi}`}>
                      <div className="bg-muted text-muted-foreground text-center text-[10px] font-semibold flex items-center justify-center">
                        S{weekNum}
                      </div>
                      {weekDaysGroup.map(day => {
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
                            onDoubleClick={e => {
                              e.stopPropagation();
                              setCurrentDate(day);
                              setViewMode('day');
                            }}
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
                    </React.Fragment>
                  );
                });
              })()}
            </div>
            </div>
          ) : viewMode === 'week' ? (
            <div className="flex-1 overflow-auto border rounded-lg">
              <div className="gap-px bg-border min-w-[700px]" style={{ display: 'grid', gridTemplateColumns: `60px repeat(${gridCols}, 1fr)` }}>
                <div className="bg-muted p-1 text-center text-xs font-medium">Heure</div>
                {filteredWeekDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const holiday = isHoliday(dateStr);
                  return (
                    <div key={dateStr} className={`bg-primary text-primary-foreground text-center text-xs font-medium py-2 ${isToday(day) ? 'ring-2 ring-accent ring-inset' : ''} ${holiday ? 'opacity-70' : ''}`}
                      onDoubleClick={e => {
                        e.stopPropagation();
                        setCurrentDate(day);
                        setViewMode('day');
                      }}
                      style={{ cursor: 'pointer' }}
                    >
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
                          onDoubleClick={e => {
                            e.stopPropagation();
                            setCurrentDate(day);
                            setViewMode('day');
                          }}
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
                      const truckZones = getTruckZones(els);
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
                            // Inter-truck element transfer
                            const transferData = e.dataTransfer.getData('application/element-transfer');
                            if (transferData) {
                              try {
                                const { sourceTruckId, elementId } = JSON.parse(transferData);
                                if (sourceTruckId !== truck.id) {
                                  removeElementFromTruck(sourceTruckId, elementId);
                                  addElementsToTruck(truck.id, [elementId]);
                                }
                              } catch {}
                              return;
                            }
                            const type = e.dataTransfer.getData('text/plain');
                            if (type === 'trucks') {
                              onDropOnDay(e, dateStr);
                              return;
                            }
                            const ids = Array.from(selectedIds).filter(id => !isElementAssigned(id));
                            if (ids.length === 0) return;
                            checkAlertsAndAssign(truck.id, ids);
                          }}
                          className={`border-l-4 transition-all ${dragOverTruckId === truck.id ? 'ring-2 ring-accent bg-accent/5' : ''} ${isEmpty ? 'border-l-foreground' : cat === 'standard' ? 'border-l-transport-standard' : cat === 'cat1' ? 'border-l-transport-cat1' : cat === 'cat2' ? 'border-l-transport-cat2' : 'border-l-transport-cat3'}`}
                        >
                          <CardContent className="pt-4 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <TruckIcon className="h-5 w-5 text-accent flex-shrink-0" />
                              <Input
                                defaultValue={truck.number}
                                onBlur={e => {
                                  const v = e.target.value.trim();
                                  if (!v || v === truck.number) return;
                                  const isDup = trucks.some(t => t.id !== truck.id && t.number.toLowerCase() === v.toLowerCase());
                                  if (isDup) {
                                    toast.error('Ce numéro de camion existe déjà.');
                                    e.target.value = truck.number;
                                    return;
                                  }
                                  updateTruck(truck.id, { number: v });
                                }}
                                className="h-7 text-lg font-semibold w-24 border-transparent hover:border-input focus:border-input bg-transparent px-1"
                              />
                              <Input
                                type="date"
                                defaultValue={truck.date}
                                onBlur={e => { const v = e.target.value; if (v && v !== truck.date) updateTruck(truck.id, { date: v }); }}
                                className="h-7 text-sm w-36 border-transparent hover:border-input focus:border-input bg-transparent px-1"
                              />
                              <Input
                                type="time"
                                defaultValue={truck.time}
                                onBlur={e => { const v = e.target.value; if (v && v !== truck.time) updateTruck(truck.id, { time: v }); }}
                              className="h-7 text-sm w-24 border-transparent hover:border-input focus:border-input bg-transparent px-1"
                              />
                              <Input
                                defaultValue={truck.transporter || ''}
                                onBlur={e => { const v = e.target.value; if (v !== (truck.transporter || '')) updateTruck(truck.id, { transporter: v }); }}
                                placeholder="Transporteur..."
                                className="h-7 text-sm w-32 text-orange-500 border-transparent hover:border-input focus:border-input bg-transparent px-1"
                              />
                              <span className={`${getCategoryColorClass(cat)} px-2 py-0.5 rounded text-xs font-medium ml-auto`}>{catInfo.label}</span>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0 flex-shrink-0">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer ce camion ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Le camion {truck.number} et ses affectations seront supprimés.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteTruck(truck.id)}>Supprimer</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div className="flex items-center gap-1"><Factory className="h-4 w-4 text-muted-foreground" />{factories.length > 0 ? factories.map(f => <span key={f} className="text-white text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: getFactoryColor(f) }}>{f}</span>) : <span>—</span>}</div>
                              <div className="flex items-center gap-1"><Weight className="h-4 w-4 text-muted-foreground" /><span>{weight.toFixed(2)} t</span></div>
                              <div className="flex items-center gap-1"><Ruler className="h-4 w-4 text-muted-foreground" /><span>{maxLen.toFixed(2)} m</span></div>
                              <div className="flex items-center gap-1"><Package className="h-4 w-4 text-muted-foreground" /><span>{els.length} produits</span></div>
                            </div>
                            {truckZones.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                {truckZones.map(z => (
                                  <span key={z} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs">{z}</span>
                                ))}
                              </div>
                            )}
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
                                      <span
                                        key={el.id}
                                        draggable
                                        onDragStart={e => {
                                          e.stopPropagation();
                                          e.dataTransfer.setData('application/element-transfer', JSON.stringify({ sourceTruckId: truck.id, elementId: el.id }));
                                          e.dataTransfer.effectAllowed = 'move';
                                        }}
                                        className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-mono flex items-center gap-0.5 cursor-grab active:cursor-grabbing"
                                      >
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
                            <Textarea
                              defaultValue={truck.comment || ''}
                              onBlur={e => { const v = e.target.value; if (v !== (truck.comment || '')) updateTruck(truck.id, { comment: v }); }}
                              placeholder="Commentaire..."
                              className="min-h-[40px] text-sm resize-none"
                            />
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
      <NewTruckModal open={showNewTruck} onClose={() => setShowNewTruck(false)} onConfirm={handleNewTruckConfirm} date={newTruckDate} trucks={trucks} teamTrucks={hasMultipleTeams ? filteredTrucks : undefined} />

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

      {/* Bulk Reassignment Dialog */}
      <Dialog open={showBulkReassign} onOpenChange={setShowBulkReassign}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Réaffecter des camions à une équipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Sélectionner les camions</Label>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                  // Select unassigned trucks (no teamId)
                  const unassigned = trucks.filter(t => !t.teamId);
                  setBulkSelectedTrucks(new Set(unassigned.map(t => t.id)));
                }}>
                  Non affectés
                </Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                  if (bulkSelectedTrucks.size === trucks.length) {
                    setBulkSelectedTrucks(new Set());
                  } else {
                    setBulkSelectedTrucks(new Set(trucks.map(t => t.id)));
                  }
                }}>
                  {bulkSelectedTrucks.size === trucks.length ? 'Désélectionner' : 'Tout'}
                </Button>
              </div>
            </div>
            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              {trucks.map(truck => {
                const els = getTruckElements(truck.id);
                const cat = getTransportCategory(els);
                const currentTeam = teams.find(t => t.id === truck.teamId);
                return (
                  <label key={truck.id} className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-secondary/50 transition-colors">
                    <Checkbox
                      checked={bulkSelectedTrucks.has(truck.id)}
                      onCheckedChange={() => {
                        setBulkSelectedTrucks(prev => {
                          const next = new Set(prev);
                          next.has(truck.id) ? next.delete(truck.id) : next.add(truck.id);
                          return next;
                        });
                      }}
                    />
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${els.length === 0 ? 'bg-foreground' : getCategoryColorClass(cat)}`} />
                    <span className="text-sm font-medium">{truck.number}</span>
                    <span className="text-xs text-muted-foreground">{truck.date} · {truck.time}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{currentTeam?.name || 'Non affecté'}</span>
                  </label>
                );
              })}
            </div>
            <div>
              <Label className="text-xs">Équipe cible</Label>
              <Select value={bulkTargetTeam} onValueChange={setBulkTargetTeam}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Choisir une équipe" /></SelectTrigger>
                <SelectContent>
                  {teams.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkReassign(false)}>Annuler</Button>
            <Button
              onClick={() => {
                bulkSelectedTrucks.forEach(truckId => {
                  updateTruck(truckId, { teamId: bulkTargetTeam });
                });
                setShowBulkReassign(false);
              }}
              disabled={bulkSelectedTrucks.size === 0 || !bulkTargetTeam}
            >
              Réaffecter ({bulkSelectedTrucks.size} camion{bulkSelectedTrucks.size > 1 ? 's' : ''})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
