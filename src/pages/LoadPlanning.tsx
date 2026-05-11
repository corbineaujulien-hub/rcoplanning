import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, BarChart3, FileDown, FileSpreadsheet, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  TransportCategory, TRANSPORT_CATEGORIES, CONDUCTORS, SUBCONTRACTORS, ForecastSlot, ForecastedTruck,
} from '@/types/delivery';
import {
  getWeeksBetween, getWeekKeyForDate, getPoseurColor, UNASSIGNED_POSEUR,
  CATEGORY_LABELS, weekOverlapsRange, ISOWeek,
} from '@/utils/loadPlanningUtils';
import { exportLoadPlanningPdf } from '@/utils/loadPlanningPdfUtils';
import { exportLoadPlanningExcel } from '@/utils/loadPlanningExcelUtils';

interface ProjectRow {
  id: string;
  site_name: string | null;
  client_name: string | null;
  otp_number: string | null;
  conductor: string | null;
  subcontractor: string | null;
  archived: boolean;
  database_complete: boolean;
}

interface TruckRow {
  id: string;
  project_id: string;
  date: string;
  element_ids: string[];
  forced_category: TransportCategory | null;
}

interface ElementRow {
  id: string;
  project_id: string;
  product_type: string;
  length: number;
  weight: number;
  factory: string;
}

const EXTENDED = ['Poteau BA', 'Potelet BA'];
function computeCategory(els: ElementRow[]): TransportCategory {
  if (!els.length) return 'standard';
  const w = els.reduce((s, e) => s + (e.weight || 0), 0);
  const l = Math.max(...els.map(e => e.length || 0));
  const ext = els.some(e => EXTENDED.includes(e.product_type));
  const stdMax = ext ? 14.5 : 13.5;
  if (l <= stdMax && w <= 28) return 'standard';
  if (l <= 16.5 && w <= 28) return 'cat1';
  if (l <= 21.5 && w <= 42) return 'cat2';
  return 'cat3';
}

async function fetchAllPaginated<T = any>(table: string, columns: string): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  let p = 0;
  while (true) {
    const { data, error } = await (supabase.from as any)(table).select(columns).range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = [...all, ...data];
    if (data.length < PAGE) break;
    p++;
  }
  return all;
}

type DataSource = 'real' | 'forecast' | 'mixed';

interface ProjectComputed {
  project: ProjectRow;
  poseur: string;
  conductor: string;
  // weekKey -> { count, source, byUsine: { usine -> { cat -> count } }, hasReal, hasForecast }
  weeks: Record<string, WeekCell>;
  usines: Set<string>;
}

interface WeekCell {
  count: number;
  source: DataSource | 'none';
  byUsineCat: Record<string, Record<TransportCategory, number>>;
}

export default function LoadPlanning() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [elements, setElements] = useState<ElementRow[]>([]);
  const [forecastSlots, setForecastSlots] = useState<ForecastSlot[]>([]);

  // Default period: 12 months sliding
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const defaultStart = useMemo(() => { const d = new Date(today); d.setMonth(d.getMonth() - 1); return d; }, [today]);
  const defaultEnd = useMemo(() => { const d = new Date(today); d.setMonth(d.getMonth() + 11); return d; }, [today]);

  const [periodStart, setPeriodStart] = useState<string>(defaultStart.toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState<string>(defaultEnd.toISOString().slice(0, 10));
  const [view, setView] = useState<'gantt' | 'calendar'>('gantt');

  const [filterCdt, setFilterCdt] = useState('all');
  const [filterPoseur, setFilterPoseur] = useState('all');
  const [filterUsine, setFilterUsine] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'planned' | 'forecast' | 'archived'>('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pData, tData, eData, fData] = await Promise.all([
          supabase.from('projects').select('id, site_name, client_name, otp_number, conductor, subcontractor, archived, database_complete'),
          fetchAllPaginated<TruckRow>('trucks', 'id, project_id, date, element_ids, forced_category'),
          fetchAllPaginated<ElementRow>('beam_elements', 'id, project_id, product_type, length, weight, factory'),
          fetchAllPaginated<any>('forecast_slots', 'id, project_id, date_start, date_end, forecasted_trucks'),
        ]);
        setProjects((pData.data as ProjectRow[]) || []);
        setTrucks((tData as any[]).map(t => ({
          id: t.id, project_id: t.project_id, date: t.date,
          element_ids: (t.element_ids as string[]) || [],
          forced_category: t.forced_category || null,
        })));
        setElements((eData as any[]).map(e => ({
          id: e.id, project_id: e.project_id,
          product_type: e.product_type || '',
          length: Number(e.length) || 0, weight: Number(e.weight) || 0,
          factory: e.factory || '',
        })));
        setForecastSlots((fData as any[]).map(s => ({
          id: s.id, projectId: s.project_id,
          dateStart: s.date_start, dateEnd: s.date_end,
          forecastedTrucks: (s.forecasted_trucks as ForecastedTruck[]) || [],
        })));
      } catch (err: any) {
        toast.error('Erreur de chargement : ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const elementsById = useMemo(() => {
    const m = new Map<string, ElementRow>();
    elements.forEach(e => m.set(e.id, e));
    return m;
  }, [elements]);

  const weeks: ISOWeek[] = useMemo(() => {
    const s = new Date(periodStart); const e = new Date(periodEnd);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return [];
    return getWeeksBetween(s, e);
  }, [periodStart, periodEnd]);

  // Compute per-project, per-week cells
  const computedProjects: ProjectComputed[] = useMemo(() => {
    return projects.map(project => {
      const projTrucks = trucks.filter(t => t.project_id === project.id && t.date);
      const projForecasts = forecastSlots.filter(s => s.projectId === project.id);

      // Aggregate real trucks by week
      const realByWeek = new Map<string, Record<string, Record<TransportCategory, number>>>();
      const usinesSet = new Set<string>();
      projTrucks.forEach(t => {
        const wk = getWeekKeyForDate(t.date);
        const els = (t.element_ids || []).map(id => elementsById.get(id)).filter(Boolean) as ElementRow[];
        const cat: TransportCategory = t.forced_category || computeCategory(els);
        const factories = Array.from(new Set(els.map(e => e.factory).filter(Boolean)));
        const factoryList = factories.length > 0 ? factories : ['(non précisée)'];
        factoryList.forEach(f => usinesSet.add(f));
        if (!realByWeek.has(wk)) realByWeek.set(wk, {});
        const w = realByWeek.get(wk)!;
        // Distribute 1 truck across factories proportionally? Keep simple: count once per factory list = primary factory
        const f = factoryList[0];
        if (!w[f]) w[f] = { standard: 0, cat1: 0, cat2: 0, cat3: 0 };
        w[f][cat] += 1;
      });

      // Forecasts by week
      const forecastByWeek = new Map<string, Record<string, Record<TransportCategory, number>>>();
      projForecasts.forEach(slot => {
        const slotWeeks = weeks.filter(w => weekOverlapsRange(w, slot.dateStart, slot.dateEnd));
        if (slotWeeks.length === 0) return;
        const perWeek = slot.forecastedTrucks.map(ft => ({
          ...ft,
          countPerWeek: ft.count / slotWeeks.length,
        }));
        slotWeeks.forEach(w => {
          if (!forecastByWeek.has(w.key)) forecastByWeek.set(w.key, {});
          const wk = forecastByWeek.get(w.key)!;
          perWeek.forEach(ft => {
            usinesSet.add(ft.usine);
            if (!wk[ft.usine]) wk[ft.usine] = { standard: 0, cat1: 0, cat2: 0, cat3: 0 };
            wk[ft.usine][ft.category] += ft.countPerWeek;
          });
        });
      });

      const weekCells: Record<string, WeekCell> = {};
      weeks.forEach(w => {
        const real = realByWeek.get(w.key);
        const fc = forecastByWeek.get(w.key);
        const hasReal = !!real && Object.keys(real).length > 0;
        const hasForecast = !!fc && Object.keys(fc).length > 0;
        const byUsineCat: Record<string, Record<TransportCategory, number>> = {};
        let count = 0;
        let source: DataSource | 'none' = 'none';
        if (hasReal) {
          source = 'real';
          for (const [usine, cats] of Object.entries(real!)) {
            byUsineCat[usine] = { ...cats };
            for (const c of Object.values(cats)) count += c;
          }
        } else if (hasForecast) {
          source = 'forecast';
          for (const [usine, cats] of Object.entries(fc!)) {
            byUsineCat[usine] = { ...cats };
            for (const c of Object.values(cats)) count += c;
          }
        }
        weekCells[w.key] = { count: Math.round(count * 10) / 10, source, byUsineCat };
      });

      return {
        project,
        poseur: project.subcontractor || UNASSIGNED_POSEUR,
        conductor: project.conductor || 'CDT à désigner',
        weeks: weekCells,
        usines: usinesSet,
      };
    });
  }, [projects, trucks, forecastSlots, elementsById, weeks]);

  // Filtering
  const filteredProjects = useMemo(() => {
    return computedProjects.filter(cp => {
      if (filterStatus === 'archived') {
        if (!cp.project.archived) return false;
      } else {
        if (cp.project.archived) return false;
      }
      if (filterCdt !== 'all' && cp.conductor !== filterCdt) return false;
      if (filterPoseur !== 'all' && cp.poseur !== filterPoseur) return false;
      if (filterUsine !== 'all' && !cp.usines.has(filterUsine)) return false;
      const sources = Object.values(cp.weeks).map(w => w.source).filter(s => s !== 'none');
      if (filterStatus === 'planned' && !sources.includes('real')) return false;
      if (filterStatus === 'forecast' && sources.every(s => s === 'real')) return false;
      return true;
    });
  }, [computedProjects, filterCdt, filterPoseur, filterUsine, filterStatus]);

  // Aggregations: load by CDT / Poseur / Usine per week
  const loadByCdt = useMemo(() => aggregate(filteredProjects, weeks, p => p.conductor), [filteredProjects, weeks]);
  const loadByPoseur = useMemo(() => aggregate(filteredProjects, weeks, p => p.poseur), [filteredProjects, weeks]);
  const loadByUsine = useMemo(() => {
    const byKey: Record<string, Record<string, number>> = {};
    filteredProjects.forEach(cp => {
      weeks.forEach(w => {
        const cell = cp.weeks[w.key];
        if (!cell || cell.count === 0) return;
        for (const [usine, cats] of Object.entries(cell.byUsineCat)) {
          if (!byKey[usine]) byKey[usine] = {};
          for (const c of Object.values(cats)) {
            byKey[usine][w.key] = (byKey[usine][w.key] || 0) + c;
          }
        }
      });
    });
    return Object.entries(byKey)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, perWeek]) => ({ key, perWeek }));
  }, [filteredProjects, weeks]);

  // Lists for filters
  const allCdts = useMemo(() => Array.from(new Set(computedProjects.map(p => p.conductor))).sort(), [computedProjects]);
  const allPoseurs = useMemo(() => Array.from(new Set(computedProjects.map(p => p.poseur))).sort(), [computedProjects]);
  const allUsines = useMemo(() => {
    const s = new Set<string>();
    computedProjects.forEach(p => p.usines.forEach(u => s.add(u)));
    return Array.from(s).sort();
  }, [computedProjects]);

  // Inline edits
  const updateProjectField = useCallback(async (projectId: string, field: 'conductor' | 'subcontractor', value: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, [field]: value } : p));
    const { error } = await supabase.from('projects').update({ [field]: value } as any).eq('id', projectId);
    if (error) toast.error('Erreur sauvegarde : ' + error.message);
    else toast.success('Mise à jour enregistrée');
  }, []);

  const resetFilters = () => {
    setFilterCdt('all'); setFilterPoseur('all'); setFilterUsine('all'); setFilterStatus('all');
  };

  const handleExportPdf = async () => {
    try {
      await exportLoadPlanningPdf({
        weeks, projects: filteredProjects,
        loadByCdt, loadByPoseur, loadByUsine,
        periodStart, periodEnd,
      });
    } catch (err: any) { toast.error('Erreur export PDF : ' + err.message); }
  };

  const handleExportExcel = async () => {
    try {
      await exportLoadPlanningExcel({
        weeks, projects: filteredProjects,
        loadByCdt, loadByPoseur, loadByUsine,
        periodStart, periodEnd,
      });
    } catch (err: any) { toast.error('Erreur export Excel : ' + err.message); }
  };

  const todayWeekKey = getWeekKeyForDate(today.toISOString().slice(0, 10));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container py-3 flex items-center justify-between gap-4 flex-wrap max-w-none">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-primary-foreground hover:bg-primary-foreground/10">
              <ArrowLeft className="h-4 w-4 mr-1" /> Accueil
            </Button>
            <img src="/logo.png" alt="Logo" className="h-7 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <BarChart3 className="h-6 w-6" />
            <h1 className="text-lg font-bold">Planning de charge annuel</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs">
              <span>Du</span>
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="h-8 w-[140px] text-foreground" />
              <span>au</span>
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="h-8 w-[140px] text-foreground" />
            </div>
            <Button variant="secondary" size="sm" onClick={handleExportPdf}>
              <FileDown className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 overflow-auto">
        {/* Filters */}
        <Card>
          <CardContent className="pt-4 flex items-center gap-2 flex-wrap">
            <Select value={filterCdt} onValueChange={setFilterCdt}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="CDT" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les CDT</SelectItem>
                {allCdts.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPoseur} onValueChange={setFilterPoseur}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Poseur" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les poseurs</SelectItem>
                {allPoseurs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterUsine} onValueChange={setFilterUsine}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Usine" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les usines</SelectItem>
                {allUsines.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="planned">Planifiés</SelectItem>
                <SelectItem value="forecast">Prévisionnels</SelectItem>
                <SelectItem value="archived">Archivés</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4 mr-1" /> Réinitialiser
            </Button>
            <div className="ml-auto">
              <Tabs value={view} onValueChange={(v: any) => setView(v)}>
                <TabsList>
                  <TabsTrigger value="gantt">Gantt</TabsTrigger>
                  <TabsTrigger value="calendar">Calendrier</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Chargement…</div>
        ) : (
          <>
            {/* 3 load summary blocks */}
            <LoadSummary title="Charge / Conducteur de travaux" rows={loadByCdt} weeks={weeks} todayKey={todayWeekKey} />
            <LoadSummary title="Charge / Poseur" rows={loadByPoseur} weeks={weeks} todayKey={todayWeekKey} colorByKey={(k) => getPoseurColor(k)} />
            <LoadSummary title="Charge / Usine" rows={loadByUsine} weeks={weeks} todayKey={todayWeekKey} />

            {view === 'gantt' ? (
              <GanttView
                weeks={weeks}
                projects={filteredProjects}
                todayKey={todayWeekKey}
                onUpdateField={updateProjectField}
              />
            ) : (
              <CalendarView projects={filteredProjects} />
            )}

            <PoseurLegend projects={filteredProjects} />
          </>
        )}
      </main>
    </div>
  );
}

function aggregate(
  projects: ProjectComputed[],
  weeks: ISOWeek[],
  keyFn: (p: ProjectComputed) => string,
): { key: string; perWeek: Record<string, number> }[] {
  const map: Record<string, Record<string, number>> = {};
  projects.forEach(p => {
    const k = keyFn(p);
    if (!map[k]) map[k] = {};
    weeks.forEach(w => {
      const c = p.weeks[w.key]?.count || 0;
      if (c) map[k][w.key] = (map[k][w.key] || 0) + c;
    });
  });
  return Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, perWeek]) => ({ key, perWeek }));
}

function LoadSummary({
  title, rows, weeks, todayKey, colorByKey,
}: {
  title: string;
  rows: { key: string; perWeek: Record<string, number> }[];
  weeks: ISOWeek[];
  todayKey: string;
  colorByKey?: (k: string) => string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background z-10 text-left p-1 border-b min-w-[180px]"></th>
              {weeks.map(w => (
                <th key={w.key} className={`p-1 border-b text-center font-normal ${w.key === todayKey ? 'bg-accent/20 font-bold' : ''}`}>
                  {w.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={weeks.length + 1} className="p-2 text-muted-foreground italic">Aucune donnée</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.key}>
                <td className="sticky left-0 bg-background z-10 p-1 border-b font-medium flex items-center gap-1">
                  {colorByKey && <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colorByKey(r.key) }} />}
                  {r.key}
                </td>
                {weeks.map(w => {
                  const v = r.perWeek[w.key] || 0;
                  return (
                    <td key={w.key} className={`p-1 border-b text-center ${w.key === todayKey ? 'bg-accent/10' : ''}`}>
                      {v ? Math.round(v * 10) / 10 : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function GanttView({
  weeks, projects, todayKey, onUpdateField,
}: {
  weeks: ISOWeek[];
  projects: ProjectComputed[];
  todayKey: string;
  onUpdateField: (id: string, field: 'conductor' | 'subcontractor', v: string) => void;
}) {
  const [editing, setEditing] = useState<{ id: string; field: 'conductor' | 'subcontractor' } | null>(null);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Planning Gantt</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background z-10 text-left p-1 border-b min-w-[280px]">Chantier</th>
              <th className="sticky left-[280px] bg-background z-10 text-left p-1 border-b min-w-[160px]">CDT</th>
              <th className="sticky left-[440px] bg-background z-10 text-left p-1 border-b min-w-[140px]">Poseur</th>
              {weeks.map(w => (
                <th key={w.key} className={`p-1 border-b text-center font-normal w-[36px] ${w.key === todayKey ? 'bg-accent/20 font-bold' : ''}`}>
                  {w.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr><td colSpan={weeks.length + 3} className="p-2 text-muted-foreground italic text-center">Aucun chantier</td></tr>
            )}
            {projects.map(cp => {
              const color = getPoseurColor(cp.poseur);
              return (
                <tr key={cp.project.id} className="hover:bg-muted/30">
                  <td className="sticky left-0 bg-background z-10 p-1 border-b">
                    <div className="font-medium truncate max-w-[260px]">{cp.project.site_name || 'Sans nom'}</div>
                    <div className="text-[10px] text-muted-foreground">{cp.project.otp_number || '—'}</div>
                  </td>
                  <td className="sticky left-[280px] bg-background z-10 p-1 border-b" onDoubleClick={() => setEditing({ id: cp.project.id, field: 'conductor' })}>
                    {editing?.id === cp.project.id && editing.field === 'conductor' ? (
                      <Select
                        defaultValue={cp.project.conductor || ''}
                        onValueChange={v => { onUpdateField(cp.project.id, 'conductor', v === '__none__' ? '' : v); setEditing(null); }}
                      >
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">CDT à désigner</SelectItem>
                          {CONDUCTORS.map(c => (
                            <SelectItem key={c.name} value={`${c.name} – ${c.phone}`}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="cursor-pointer" title="Double-clic pour modifier">{cp.conductor.split(' – ')[0]}</span>
                    )}
                  </td>
                  <td className="sticky left-[440px] bg-background z-10 p-1 border-b" onDoubleClick={() => setEditing({ id: cp.project.id, field: 'subcontractor' })}>
                    {editing?.id === cp.project.id && editing.field === 'subcontractor' ? (
                      <Select
                        defaultValue={cp.project.subcontractor || ''}
                        onValueChange={v => { onUpdateField(cp.project.id, 'subcontractor', v === '__none__' ? '' : v); setEditing(null); }}
                      >
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Poseur à désigner</SelectItem>
                          {SUBCONTRACTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="cursor-pointer flex items-center gap-1" title="Double-clic pour modifier">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
                        {cp.poseur}
                      </span>
                    )}
                  </td>
                  {weeks.map(w => {
                    const cell = cp.weeks[w.key];
                    const v = cell?.count || 0;
                    const isForecast = cell?.source === 'forecast';
                    return (
                      <td key={w.key} className={`p-0 border-b text-center align-middle ${w.key === todayKey ? 'bg-accent/10' : ''}`}>
                        {v > 0 && (
                          <div
                            className="text-[10px] font-bold text-white py-1 mx-0.5 rounded-sm"
                            title={`${cp.project.site_name} — S${w.label}: ${v} camion(s) ${isForecast ? '(prévisionnel)' : '(réel)'}`}
                            style={{
                              background: isForecast
                                ? `repeating-linear-gradient(45deg, ${color}, ${color} 4px, rgba(255,255,255,0.45) 4px, rgba(255,255,255,0.45) 8px)`
                                : color,
                              opacity: isForecast ? 0.85 : 1,
                            }}
                          >
                            {Math.round(v * 10) / 10}{isForecast ? 'P' : ''}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CalendarView({ projects }: { projects: ProjectComputed[] }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });

  const monthLabel = cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const monthStart = new Date(cursor);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const weeks = getWeeksBetween(monthStart, monthEnd);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="capitalize">{monthLabel}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {weeks.map(w => {
          const projectsThisWeek = projects.filter(p => (p.weeks[w.key]?.count || 0) > 0);
          return (
            <div key={w.key} className="border rounded-md p-2">
              <div className="text-xs font-medium mb-1">{w.label} — {w.start.toLocaleDateString('fr-FR')} → {w.end.toLocaleDateString('fr-FR')}</div>
              <div className="flex flex-wrap gap-1">
                {projectsThisWeek.length === 0 && <span className="text-xs text-muted-foreground italic">Aucun chantier</span>}
                {projectsThisWeek.map(cp => {
                  const cell = cp.weeks[w.key];
                  const isForecast = cell.source === 'forecast';
                  const color = getPoseurColor(cp.poseur);
                  return (
                    <span
                      key={cp.project.id}
                      className="text-[10px] px-2 py-0.5 rounded-full text-white"
                      style={{
                        background: isForecast
                          ? `repeating-linear-gradient(45deg, ${color}, ${color} 3px, rgba(255,255,255,0.4) 3px, rgba(255,255,255,0.4) 6px)`
                          : color,
                      }}
                      title={`${cp.project.site_name} — ${cell.count} camion(s)`}
                    >
                      {cp.project.site_name || cp.project.otp_number} ({Math.round(cell.count * 10) / 10}{isForecast ? 'P' : ''})
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PoseurLegend({ projects }: { projects: ProjectComputed[] }) {
  const poseurs = Array.from(new Set(projects.map(p => p.poseur))).sort();
  return (
    <Card>
      <CardContent className="pt-4 flex flex-wrap gap-3 text-xs">
        <span className="font-medium">Légende poseurs :</span>
        {poseurs.map(p => (
          <span key={p} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: getPoseurColor(p) }} />
            {p}
          </span>
        ))}
        <span className="ml-4 flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'repeating-linear-gradient(45deg, #888, #888 3px, #fff 3px, #fff 6px)' }} />
          Données prévisionnelles
        </span>
      </CardContent>
    </Card>
  );
}