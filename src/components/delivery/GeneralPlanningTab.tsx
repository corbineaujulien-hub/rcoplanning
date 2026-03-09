import { useState, useMemo } from 'react';
import { useDelivery } from '@/context/DeliveryContext';
import { Truck } from '@/types/delivery';
import { getTransportCategory, getTruckWeight, getCategoryColorClass } from '@/utils/transportUtils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Truck as TruckIcon, FileSpreadsheet, Calendar, MessageSquare } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, isSameMonth, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import TruckDetailModal from './TruckDetailModal';
import * as XLSX from 'xlsx';

export default function GeneralPlanningTab() {
  const { trucks, getTruckElements } = useDelivery();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [detailTruck, setDetailTruck] = useState<Truck | null>(null);

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

  const getTrucksForDate = (dateStr: string) =>
    trucks.filter(t => t.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));

  const navigate = (dir: number) => {
    setCurrentDate(prev => viewMode === 'month' ? (dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1)) : (dir > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1)));
  };

  const exportExcel = () => {
    const data = trucks.map(t => {
      const els = getTruckElements(t.id);
      const cat = getTransportCategory(els);
      return {
        'Date': t.date,
        'Horaire': t.time,
        'N° Camion': t.number,
        'Poids (t)': getTruckWeight(els).toFixed(2),
        'Nb produits': els.length,
        'Catégorie': cat,
        'Repères': els.map(e => e.repere).join(', '),
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Planning général');
    XLSX.writeFile(wb, 'planning_general.xlsx');
  };

  const exportPDF = () => {
    window.print();
  };

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-lg font-semibold capitalize min-w-[200px] text-center">
            {viewMode === 'month' ? format(currentDate, 'MMMM yyyy', { locale: fr }) : `Semaine ${format(currentDate, 'II')}`}
          </h2>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex gap-2">
          <Button variant={viewMode === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('month')}>Mois</Button>
          <Button variant={viewMode === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('week')}>Semaine</Button>
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <Calendar className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {dayNames.map(d => (
          <div key={d} className="bg-primary text-primary-foreground text-center text-xs font-medium py-2">{d}</div>
        ))}
        {calendarDays.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayTrucks = getTrucksForDate(dateStr);
          const inMonth = viewMode === 'month' ? isSameMonth(day, currentDate) : true;
          return (
            <div key={dateStr} className={`bg-card p-1 ${viewMode === 'week' ? 'min-h-[300px]' : 'min-h-[80px]'} ${!inMonth ? 'opacity-40' : ''} ${isToday(day) ? 'ring-2 ring-accent ring-inset' : ''}`}>
              <div className={`text-xs font-medium mb-1 ${isToday(day) ? 'text-accent' : 'text-muted-foreground'}`}>{format(day, 'd')}</div>
              <div className="space-y-1">
                {dayTrucks.map(truck => {
                  const els = getTruckElements(truck.id);
                  const cat = getTransportCategory(els);
                  const weight = getTruckWeight(els);
                  return (
                    <div key={truck.id} onClick={() => setDetailTruck(truck)} className={`truck-badge ${getCategoryColorClass(cat)} flex items-center gap-1`}>
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

      <TruckDetailModal open={!!detailTruck} onClose={() => setDetailTruck(null)} truck={detailTruck} />
    </div>
  );
}
