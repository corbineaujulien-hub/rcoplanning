import { useMemo } from 'react';
import ActiveUsersNotification from '@/components/ActiveUsersNotification';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { useDelivery } from '@/context/DeliveryContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import GeneralInfoTab from '@/components/delivery/GeneralInfoTab';
import DatabaseTab from '@/components/delivery/DatabaseTab';
import TruckCompositionTab from '@/components/delivery/TruckCompositionTab';
import WeeklyPlanningTab from '@/components/delivery/WeeklyPlanningTab';
import { Truck as TruckIcon, ClipboardList, Database, Calendar, FileSpreadsheet, Home } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { getTransportCategory, getTruckWeight, getTruckMaxLength, getTruckFactories } from '@/utils/transportUtils';
import { TRANSPORT_CATEGORIES } from '@/types/delivery';
import * as XLSX from 'xlsx';
import { exportAllWeeksPdf } from '@/utils/pdfExportUtils';

export default function DeliveryApp() {
  const { trucks, projectInfo, elements, getTruckElements, teams } = useDelivery();
  const navigate = useNavigate();

  const hasMultipleTeams = teams.length > 1;

  // Build weekly tabs, optionally per team
  const weeklyTabs = useMemo(() => {
    const weeks = new Map<string, { weekNumber: number; year: number }>();
    trucks.forEach(t => {
      const d = parseISO(t.date);
      const wn = parseInt(format(d, 'II'));
      const y = d.getFullYear();
      const key = `${y}-${wn}`;
      if (!weeks.has(key)) weeks.set(key, { weekNumber: wn, year: y });
    });
    return Array.from(weeks.values()).sort((a, b) => a.year - b.year || a.weekNumber - b.weekNumber);
  }, [trucks]);

  // For multi-team: build tabs per team per week
  const weeklyTeamTabs = useMemo(() => {
    if (!hasMultipleTeams) return [];
    const result: { weekNumber: number; year: number; teamId: string; teamName: string }[] = [];
    weeklyTabs.forEach(w => {
      teams.forEach(team => {
        // Check if this team has trucks in this week
        const hasData = trucks.some(t => {
          const d = parseISO(t.date);
          const wn = parseInt(format(d, 'II'));
          const y = d.getFullYear();
          return wn === w.weekNumber && y === w.year && t.teamId === team.id;
        });
        if (hasData) {
          result.push({ ...w, teamId: team.id, teamName: team.name });
        }
      });
      // Also check for trucks with no team assigned
      const hasUnassigned = trucks.some(t => {
        const d = parseISO(t.date);
        const wn = parseInt(format(d, 'II'));
        const y = d.getFullYear();
        return wn === w.weekNumber && y === w.year && !t.teamId;
      });
      if (hasUnassigned) {
        result.push({ ...w, teamId: '__none__', teamName: 'Sans équipe' });
      }
    });
    return result;
  }, [weeklyTabs, teams, trucks, hasMultipleTeams]);

  const exportAllWeeksExcel = () => {
    const wb = XLSX.utils.book_new();
    weeklyTabs.forEach(w => {
      const weekTrucks = trucks
        .filter(t => {
          const d = parseISO(t.date);
          return parseInt(format(d, 'II')) === w.weekNumber && d.getFullYear() === w.year;
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

      const data = weekTrucks.map(t => {
        const els = getTruckElements(t.id);
        return {
          'Date': t.date,
          'Horaire': t.time,
          'N° Camion': t.number,
          'Équipe': hasMultipleTeams ? (teams.find(tm => tm.id === t.teamId)?.name || '—') : undefined,
          'Usine': getTruckFactories(els).join(', '),
          'Poids (t)': getTruckWeight(els).toFixed(2),
          'Plus long (m)': getTruckMaxLength(els).toFixed(2),
          'Catégorie': TRANSPORT_CATEGORIES[getTransportCategory(els)].label,
          'Nb produits': els.length,
          'Repères': els.map(e => e.repere).join(', '),
          'Commentaire': t.comment || '',
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, `S${String(w.weekNumber).padStart(2, '0')}`);
    });
    XLSX.writeFile(wb, `planning_toutes_semaines.xlsx`);
  };

  const totalSiteWeight = useMemo(() => elements.reduce((s, e) => s + e.weight, 0), [elements]);

  // Compute planning progress (loaded weight / total weight)
  const loadedWeight = useMemo(() => {
    const assignedIds = new Set(trucks.flatMap(t => t.elementIds));
    return elements.filter(e => assignedIds.has(e.id)).reduce((s, e) => s + e.weight, 0);
  }, [trucks, elements]);

  const planningPct = totalSiteWeight > 0 ? Math.round((loadedWeight / totalSiteWeight) * 100) : 0;

  const handleExportAllWeeksPdf = async () => {
    await exportAllWeeksPdf(weeklyTabs, trucks, getTruckElements, projectInfo, totalSiteWeight, trucks);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container py-3 flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <TruckIcon className="h-7 w-7" />
           <div className="flex-1 min-w-0">
             <h1 className="text-lg font-bold tracking-tight">RECTOR – Planification des livraisons</h1>
             {projectInfo.siteName && (
               <div className="flex items-center gap-3">
                 <p className="text-xs text-primary-foreground/70 shrink-0">{projectInfo.siteName} {projectInfo.otpNumber && `(${projectInfo.otpNumber})`}</p>
                  <div className="flex items-center gap-2 flex-1 max-w-xs bg-primary-foreground/15 rounded-full px-3 py-1">
                    <span className="text-xs text-primary-foreground shrink-0">Planification</span>
                    <Progress value={planningPct} className="h-2.5 flex-1 bg-primary-foreground/30 [&>div]:bg-accent" />
                    <span className="text-xs font-bold text-primary-foreground w-8 text-right">{planningPct}%</span>
                  </div>
               </div>
             )}
           </div>
          <ActiveUsersNotification projectId={projectInfo.projectId || ''} />
          <Button variant="ghost" size="sm" className="text-primary-foreground/70 hover:text-primary-foreground" onClick={() => navigate('/')}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="container py-4">
        <Tabs defaultValue="info">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1 mb-4">
            <TabsTrigger value="info" className="flex items-center gap-1 text-xs">
              <ClipboardList className="h-3.5 w-3.5" /> Infos générales
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-1 text-xs">
              <Database className="h-3.5 w-3.5" /> Base de données
            </TabsTrigger>
            <TabsTrigger value="composition" className="flex items-center gap-1 text-xs">
              <TruckIcon className="h-3.5 w-3.5" /> Compo camion
            </TabsTrigger>
            
            {!hasMultipleTeams && weeklyTabs.map(w => (
              <TabsTrigger key={`${w.year}-${w.weekNumber}`} value={`week-${w.year}-${w.weekNumber}`} className="flex items-center gap-1 text-xs">
                <Calendar className="h-3.5 w-3.5" /> S.{String(w.weekNumber).padStart(2, '0')}
              </TabsTrigger>
            ))}

            {hasMultipleTeams && weeklyTeamTabs.map(w => (
              <TabsTrigger key={`${w.year}-${w.weekNumber}-${w.teamId}`} value={`week-${w.year}-${w.weekNumber}-${w.teamId}`} className="flex items-center gap-1 text-xs">
                <Calendar className="h-3.5 w-3.5" /> S.{String(w.weekNumber).padStart(2, '0')} {w.teamName}
              </TabsTrigger>
            ))}

            {weeklyTabs.length > 0 && (
              <div className="flex items-center gap-1 ml-auto">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={exportAllWeeksExcel}>
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Tout Excel
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleExportAllWeeksPdf}>
                  <Calendar className="h-3.5 w-3.5 mr-1" /> Exporter tout en PDF
                </Button>
              </div>
            )}
          </TabsList>

          <TabsContent value="info"><GeneralInfoTab /></TabsContent>
          <TabsContent value="database"><DatabaseTab /></TabsContent>
          <TabsContent value="composition"><TruckCompositionTab /></TabsContent>
          
          {!hasMultipleTeams && weeklyTabs.map(w => (
            <TabsContent key={`${w.year}-${w.weekNumber}`} value={`week-${w.year}-${w.weekNumber}`}>
              <WeeklyPlanningTab weekNumber={w.weekNumber} year={w.year} />
            </TabsContent>
          ))}

          {hasMultipleTeams && weeklyTeamTabs.map(w => (
            <TabsContent key={`${w.year}-${w.weekNumber}-${w.teamId}`} value={`week-${w.year}-${w.weekNumber}-${w.teamId}`}>
              <WeeklyPlanningTab weekNumber={w.weekNumber} year={w.year} teamId={w.teamId === '__none__' ? undefined : w.teamId} />
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
