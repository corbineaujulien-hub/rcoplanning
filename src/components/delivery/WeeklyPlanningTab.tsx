import { useMemo } from 'react';
import { useDelivery } from '@/context/DeliveryContext';
import { getTransportCategory, getTruckWeight, getTruckMaxLength, getTruckFactories, getProductCountsByType, getCategoryColorClass } from '@/utils/transportUtils';
import { TRANSPORT_CATEGORIES } from '@/types/delivery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Truck as TruckIcon, Weight, Ruler, Factory, Package, FileSpreadsheet, Calendar, MessageSquare } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface WeeklyPlanningTabProps {
  weekNumber: number;
  year: number;
}

export default function WeeklyPlanningTab({ weekNumber, year }: WeeklyPlanningTabProps) {
  const { projectInfo, trucks, elements, getTruckElements } = useDelivery();

  const weekTrucks = useMemo(() => {
    return trucks
      .filter(t => {
        const d = parseISO(t.date);
        const wn = parseInt(format(d, 'II'));
        const y = d.getFullYear();
        return wn === weekNumber && y === year;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [trucks, weekNumber, year]);

  const weekStart = useMemo(() => {
    if (weekTrucks.length === 0) return null;
    const firstDate = parseISO(weekTrucks[0].date);
    return startOfWeek(firstDate, { weekStartsOn: 1 });
  }, [weekTrucks]);

  const weekEnd = useMemo(() => {
    if (!weekStart) return null;
    return endOfWeek(weekStart, { weekStartsOn: 1 });
  }, [weekStart]);

  const totalSiteWeight = useMemo(() => elements.reduce((s, e) => s + e.weight, 0), [elements]);
  const weekWeight = useMemo(() => {
    return weekTrucks.reduce((sum, t) => sum + getTruckWeight(getTruckElements(t.id)), 0);
  }, [weekTrucks, getTruckElements]);

  const cumulativeWeight = useMemo(() => {
    const allWeeksBefore = trucks
      .filter(t => {
        const d = parseISO(t.date);
        const wn = parseInt(format(d, 'II'));
        const y = d.getFullYear();
        return (y < year) || (y === year && wn <= weekNumber);
      });
    return allWeeksBefore.reduce((sum, t) => sum + getTruckWeight(getTruckElements(t.id)), 0);
  }, [trucks, weekNumber, year, getTruckElements]);

  const weekProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    weekTrucks.forEach(t => {
      getTruckElements(t.id).forEach(el => {
        counts[el.productType] = (counts[el.productType] || 0) + 1;
      });
    });
    return counts;
  }, [weekTrucks, getTruckElements]);

  const totalProducts = Object.values(weekProductCounts).reduce((s, c) => s + c, 0);

  const exportExcel = () => {
    const data = weekTrucks.map(t => {
      const els = getTruckElements(t.id);
      return {
        'Date': t.date,
        'Horaire': t.time,
        'N° Camion': t.number,
        'Usine': getTruckFactories(els).join(', '),
        'Poids (t)': getTruckWeight(els).toFixed(2),
        'Plus long (m)': getTruckMaxLength(els).toFixed(2),
        'Catégorie': TRANSPORT_CATEGORIES[getTransportCategory(els)].label,
        'Nb produits': els.length,
        'Repères': els.map(e => e.repere).join(', '),
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `S${weekNumber}`);
    XLSX.writeFile(wb, `planning_S${weekNumber}.xlsx`);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>
              Semaine {weekNumber}
              {weekStart && weekEnd && ` – du ${format(weekStart, 'dd/MM', { locale: fr })} au ${format(weekEnd, 'dd/MM/yyyy', { locale: fr })}`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Calendar className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {projectInfo.siteName && <p><strong>Chantier :</strong> {projectInfo.siteName} (OTP: {projectInfo.otpNumber})</p>}
          {projectInfo.clientName && <p><strong>Client :</strong> {projectInfo.clientName}</p>}
          {projectInfo.siteAddress && <p><strong>Adresse :</strong> {projectInfo.siteAddress}</p>}
          {projectInfo.conductor && <p><strong>Conducteur :</strong> {projectInfo.conductor}</p>}
          {projectInfo.subcontractor && <p><strong>Poseur :</strong> {projectInfo.subcontractor}</p>}
        </CardContent>
      </Card>

      {/* Truck blocks */}
      {weekTrucks.map(truck => {
        const els = getTruckElements(truck.id);
        const cat = getTransportCategory(els);
        const catInfo = TRANSPORT_CATEGORIES[cat];
        const weight = getTruckWeight(els);
        const maxLen = getTruckMaxLength(els);
        const factories = getTruckFactories(els);
        const counts = getProductCountsByType(els);

        return (
          <Card key={truck.id} className={`border-l-4 ${getCategoryColorClass(cat).includes('standard') ? 'border-l-transport-standard' : getCategoryColorClass(cat).includes('cat1') ? 'border-l-transport-cat1' : getCategoryColorClass(cat).includes('cat2') ? 'border-l-transport-cat2' : 'border-l-transport-cat3'}`}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <TruckIcon className="h-5 w-5 text-accent" />
                  <span className="font-semibold text-lg">{truck.number}</span>
                  <span className={`${getCategoryColorClass(cat)} px-2 py-0.5 rounded text-xs font-medium`}>{catInfo.label}</span>
                </div>
                <span className="text-sm text-muted-foreground">{format(parseISO(truck.date), 'EEEE dd/MM/yyyy', { locale: fr })} à {truck.time}</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-1"><Factory className="h-4 w-4 text-muted-foreground" /><span>{factories.join(', ') || '—'}</span></div>
                <div className="flex items-center gap-1"><Weight className="h-4 w-4 text-muted-foreground" /><span>{weight.toFixed(2)} t</span></div>
                <div className="flex items-center gap-1"><Ruler className="h-4 w-4 text-muted-foreground" /><span>{maxLen.toFixed(2)} m</span></div>
                <div className="flex items-center gap-1"><Package className="h-4 w-4 text-muted-foreground" /><span>{els.length} produits</span></div>
              </div>

              <div className="flex flex-wrap gap-1">
                {Object.entries(counts).map(([type, count]) => (
                  <span key={type} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs">{count}× {type}</span>
                ))}
              </div>

              <div className="flex flex-wrap gap-1">
                {els.map(el => (
                  <span key={el.id} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-mono">{el.repere}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {weekTrucks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune livraison planifiée pour cette semaine.
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      {weekTrucks.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-semibold mb-3">Récapitulatif semaine {weekNumber}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground">Produits livrés</p>
                <p className="text-xl font-bold">{totalProducts}</p>
                <div className="mt-1 space-y-0.5">
                  {Object.entries(weekProductCounts).map(([type, count]) => (
                    <p key={type} className="text-xs">{count}× {type}</p>
                  ))}
                </div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground">Tonnage semaine</p>
                <p className="text-xl font-bold">{weekWeight.toFixed(2)} t</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground">Avancement hebdo</p>
                <p className="text-xl font-bold">{totalSiteWeight > 0 ? ((weekWeight / totalSiteWeight) * 100).toFixed(1) : 0} %</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground">Avancement cumulé</p>
                <p className="text-xl font-bold">{totalSiteWeight > 0 ? ((cumulativeWeight / totalSiteWeight) * 100).toFixed(1) : 0} %</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
