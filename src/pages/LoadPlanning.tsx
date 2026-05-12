import React, { useEffect, useMemo, useState, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { ArrowLeft, BarChart3, FileDown, FileSpreadsheet, RotateCcw, X, ChevronRight, ChevronDown } from 'lucide-react';
import ForecastWeeksStrip from '@/components/delivery/ForecastWeeksStrip';
import { toast } from 'sonner';
import {
  TransportCategory, CONDUCTORS, SUBCONTRACTORS, ForecastedTransport, ForecastWeek,
} from '@/types/delivery';
import {
  getWeeksBetween, getWeekKeyForDate, getPoseurColor, UNASSIGNED_POSEUR,
  ISOWeek,
} from '@/utils/loadPlanningUtils';
import { exportLoadPlanningPdf } from '@/utils/loadPlanningPdfUtils';
import { exportLoadPlanningExcel } from '@/utils/loadPlanningExcelUtils';

const UNASSIGNED_CDT = 'CDT à désigner';
const UNASSIGNED_USINE = 'Usine non précisée';

interface ProjectRow {
  id: string;
  site_name: string | null;
  client_name: string | null;
  otp_number: string | null;
  conductor: string | null;
  subcontractor: string | null;
  archived: boolean;
  database_complete: boolean;
  forecasted_transports: ForecastedTransport[] | null;
  forecast_team_count: number;
}

interface TruckRow {
  id: string;
  project_id: string;
  date: string;
  element_ids: string[];
  forced_category: TransportCategory | null;
  team_id: string | null;
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

interface WeekCell {
  count: number; // truck count (real or forecast share)
  teams: number; // distinct teams for the week (real) — 1 if forecast-only
  source: DataSource | 'none';
  byUsineCat: Record<string, Record<TransportCategory, number>>;
}

interface ProjectComputed {
  project: ProjectRow;
  poseur: string;
  conductor: string;
  weeks: Record<string, WeekCell>;
  usines: Set<string>;
}

// ---------- Months grouping ----------
interface MonthGroup {
  label: string;
  weeks: ISOWeek[];
  splitWeekKeys: Set<string>;
  weekRange: Record<string, { from: string; to: string }>;
}

function buildMonthGroups(weeks: ISOWeek[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const fmtDay = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  weeks.forEach(w => {
    const counts: Record<string, { y: number; m: number; n: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(w.start);
      d.setDate(d.getDate() + i);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (!counts[k]) counts[k] = { y: d.getFullYear(), m: d.getMonth(), n: 0 };
      counts[k].n++;
    }
    const entries = Object.values(counts);
    const split = entries.length > 1;
    entries.sort((a, b) => b.n - a.n);
    const owner = entries[0];
    const label = new Date(owner.y, owner.m, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      .replace(/^./, c => c.toUpperCase());
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) {
      g = { label, weeks: [], splitWeekKeys: new Set(), weekRange: {} };
      groups.push(g);
    }
    g.weeks.push(w);
    g.weekRange[w.key] = { from: fmtDay(w.start), to: fmtDay(w.end) };
    if (split) g.splitWeekKeys.add(w.key);
  });
  return groups;
}

function stripPhone(s: string): string {
  return (s || '').split(' – ')[0].split(' - ')[0].trim();
}

function simpleISOWeekStart(year: number, week: number): Date {
  // Returns Monday of given ISO week (approximation good enough for sorting)
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const day = simple.getUTCDay() || 7;
  if (day <= 4) simple.setUTCDate(simple.getUTCDate() - day + 1);
  else simple.setUTCDate(simple.getUTCDate() + 8 - day);
  return simple;
}

function sortWithSentinelLast<T>(arr: T[], keyFn: (x: T) => string, sentinels: string[]): T[] {
  return [...arr].sort((a, b) => {
    const ka = keyFn(a), kb = keyFn(b);
    const sa = sentinels.includes(ka) ? 1 : 0;
    const sb = sentinels.includes(kb) ? 1 : 0;
    if (sa !== sb) return sa - sb;
    return ka.localeCompare(kb);
  });
}

function heatStyle(v: number, max: number): React.CSSProperties {
  if (!v || !max) return {};
  const ratio = v / max;
  let bg = '#86efac';
  if (ratio >= 0.66) bg = '#fca5a5';
  else if (ratio >= 0.33) bg = '#fed7aa';
  return { background: bg };
}

export default function LoadPlanning() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [elements, setElements] = useState<ElementRow[]>([]);
  const [forecastWeeks, setForecastWeeks] = useState<ForecastWeek[]>([]);
  const [tokens, setTokens] = useState<Record<string, string>>({});

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const defaultStart = useMemo(() => { const d = new Date(today); d.setMonth(d.getMonth() - 1); return d; }, [today]);
  const defaultEnd = useMemo(() => { const d = new Date(today); d.setMonth(d.getMonth() + 11); return d; }, [today]);

  const [periodStart, setPeriodStart] = useState<string>(defaultStart.toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState<string>(defaultEnd.toISOString().slice(0, 10));

  const [filterCdt, setFilterCdt] = useState('all');
  const [filterPoseur, setFilterPoseur] = useState('all');
  const [filterUsine, setFilterUsine] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'planned' | 'forecast'>('all');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pData, tData, eData, fData, lData] = await Promise.all([
          supabase.from('projects').select('id, site_name, client_name, otp_number, conductor, subcontractor, archived, database_complete, forecasted_transports, forecast_team_count'),
          fetchAllPaginated<TruckRow>('trucks', 'id, project_id, date, element_ids, forced_category, team_id'),
          fetchAllPaginated<ElementRow>('beam_elements', 'id, project_id, product_type, length, weight, factory'),
          fetchAllPaginated<any>('forecast_weeks', 'id, project_id, year, week_number'),
          fetchAllPaginated<any>('project_access_links', 'project_id, token'),
        ]);
        setProjects(((pData.data as any[]) || []).map(p => ({
          ...p,
          forecasted_transports: (p.forecasted_transports as ForecastedTransport[]) || [],
          forecast_team_count: p.forecast_team_count ?? 1,
        })) as ProjectRow[]);
        setTrucks((tData as any[]).map(t => ({
          id: t.id, project_id: t.project_id, date: t.date,
          element_ids: (t.element_ids as string[]) || [],
          forced_category: t.forced_category || null,
          team_id: t.team_id || null,
        })));
        setElements((eData as any[]).map(e => ({
          id: e.id, project_id: e.project_id,
          product_type: e.product_type || '',
          length: Number(e.length) || 0, weight: Number(e.weight) || 0,
          factory: e.factory || '',
        })));
        setForecastWeeks((fData as any[]).map(s => ({
          id: s.id, projectId: s.project_id, year: s.year, weekNumber: s.week_number,
          teamIndex: s.team_index ?? 0,
        })));
        const tokMap: Record<string, string> = {};
        (lData as any[]).forEach(l => { if (l.project_id && l.token && !tokMap[l.project_id]) tokMap[l.project_id] = l.token; });
        setTokens(tokMap);
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

  const monthGroups = useMemo(() => buildMonthGroups(weeks), [weeks]);

  const computedProjects: ProjectComputed[] = useMemo(() => {
    return projects.map(project => {
      const projTrucks = trucks.filter(t => t.project_id === project.id && t.date);
      const projWeeks = forecastWeeks.filter(s => s.projectId === project.id);
      const projTransports = project.forecasted_transports || [];

      const realByWeek = new Map<string, Record<string, Record<TransportCategory, number>>>();
      const teamsByWeek = new Map<string, Set<string>>();
      const usinesSet = new Set<string>();
      projTrucks.forEach(t => {
        const wk = getWeekKeyForDate(t.date);
        const els = (t.element_ids || []).map(id => elementsById.get(id)).filter(Boolean) as ElementRow[];
        const cat: TransportCategory = t.forced_category || computeCategory(els);
        const factories = Array.from(new Set(els.map(e => e.factory).filter(Boolean)));
        const factoryList = factories.length > 0 ? factories : [UNASSIGNED_USINE];
        factoryList.forEach(f => usinesSet.add(f));
        if (!realByWeek.has(wk)) realByWeek.set(wk, {});
        const w = realByWeek.get(wk)!;
        const f = factoryList[0];
        if (!w[f]) w[f] = { standard: 0, cat1: 0, cat2: 0, cat3: 0 };
        w[f][cat] += 1;
        if (!teamsByWeek.has(wk)) teamsByWeek.set(wk, new Set());
        teamsByWeek.get(wk)!.add(t.team_id || '__notrack__');
      });

      // Forecast: distribute total project transports evenly across DISTINCT selected weeks (any team) within visible range.
      // Count number of distinct teams per week to drive CDT/Poseur load.
      const teamsByForecastWeek = new Map<string, Set<number>>();
      projWeeks.forEach(fw => {
        const w = weeks.find(x => x.year === fw.year && x.week === fw.weekNumber);
        if (!w) return;
        if (!teamsByForecastWeek.has(w.key)) teamsByForecastWeek.set(w.key, new Set());
        teamsByForecastWeek.get(w.key)!.add(fw.teamIndex ?? 0);
      });
      const visibleForecastWeekKeys = Array.from(teamsByForecastWeek.keys());
      const visibleForecastWeeks = visibleForecastWeekKeys
        .map(k => weeks.find(w => w.key === k))
        .filter(Boolean) as ISOWeek[];
      const forecastByWeek = new Map<string, Record<string, Record<TransportCategory, number>>>();
      if (visibleForecastWeeks.length > 0) {
        const n = visibleForecastWeeks.length;
        const validTransports = projTransports.filter(t => t.usine && t.usine.trim());
        const totalTrucks = validTransports.reduce(
          (s, t) => s + (t.standard || 0) + (t.cat1 || 0) + (t.cat2 || 0) + (t.cat3 || 0) + (t.exceptional || 0),
          0,
        );
        visibleForecastWeeks.forEach(w => {
          const wk: Record<string, Record<TransportCategory, number>> = {};
          if (totalTrucks > 0) {
            validTransports.forEach(t => {
              usinesSet.add(t.usine);
              wk[t.usine] = {
                standard: (t.standard || 0) / n,
                cat1: (t.cat1 || 0) / n,
                cat2: (t.cat2 || 0) / n,
                cat3: ((t.cat3 || 0) + (t.exceptional || 0)) / n,
              };
            });
          } else {
            // Week selected but no transports — placeholder so CDT/Poseur teams still counted
            wk[UNASSIGNED_USINE] = { standard: 0, cat1: 0, cat2: 0, cat3: 0 };
          }
          forecastByWeek.set(w.key, wk);
        });
      }

      const weekCells: Record<string, WeekCell> = {};
      weeks.forEach(w => {
        const real = realByWeek.get(w.key);
        const fc = forecastByWeek.get(w.key);
        const hasReal = !!real && Object.keys(real).length > 0;
        const hasForecast = !!fc && Object.keys(fc).length > 0;
        const byUsineCat: Record<string, Record<TransportCategory, number>> = {};
        let count = 0;
        let teams = 0;
        let source: DataSource | 'none' = 'none';
        if (hasReal) {
          source = 'real';
          for (const [usine, cats] of Object.entries(real!)) {
            byUsineCat[usine] = { ...cats };
            for (const c of Object.values(cats)) count += c;
          }
          teams = teamsByWeek.get(w.key)?.size || 1;
        } else if (hasForecast) {
          source = 'forecast';
          for (const [usine, cats] of Object.entries(fc!)) {
            byUsineCat[usine] = { ...cats };
            for (const c of Object.values(cats)) count += c;
          }
          teams = teamsByForecastWeek.get(w.key)?.size || 0;
        }
        weekCells[w.key] = { count: Math.round(count * 10) / 10, teams, source, byUsineCat };
      });

      return {
        project,
        poseur: project.subcontractor || UNASSIGNED_POSEUR,
        conductor: stripPhone(project.conductor || '') || UNASSIGNED_CDT,
        weeks: weekCells,
        usines: usinesSet,
      };
    });
  }, [projects, trucks, forecastWeeks, elementsById, weeks]);

  // Filtering — archived treated like active. Supports excluding a single filter
  // (used to compute available values in dropdowns for cumulative behaviour).
  const filterFn = useCallback((cp: ProjectComputed, exclude?: 'cdt' | 'poseur' | 'usine' | 'status') => {
    const q = searchText.trim().toLowerCase();
    if (exclude !== 'cdt' && filterCdt !== 'all' && cp.conductor !== filterCdt) return false;
    if (exclude !== 'poseur' && filterPoseur !== 'all' && cp.poseur !== filterPoseur) return false;
    if (exclude !== 'usine' && filterUsine !== 'all' && !cp.usines.has(filterUsine)) return false;
    if (exclude !== 'status') {
      const sources = Object.values(cp.weeks).map(w => w.source).filter(s => s !== 'none');
      if (filterStatus === 'planned' && !sources.includes('real')) return false;
      if (filterStatus === 'forecast' && sources.length > 0 && sources.every(s => s === 'real')) return false;
    }
    if (q) {
      const hay = [
        cp.project.otp_number || '',
        cp.project.site_name || '',
        cp.project.client_name || '',
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }, [filterCdt, filterPoseur, filterUsine, filterStatus, searchText]);

  const filteredProjects = useMemo(
    () => computedProjects.filter(cp => filterFn(cp)),
    [computedProjects, filterFn],
  );

  // Sort Gantt by earliest planned (real) truck, then earliest forecast slot, then no date.
  const projectFirstDate = useMemo(() => {
    const real = new Map<string, string>();
    trucks.forEach(t => {
      if (!t.date) return;
      const cur = real.get(t.project_id);
      if (!cur || t.date < cur) real.set(t.project_id, t.date);
    });
    const fc = new Map<string, string>();
    forecastWeeks.forEach(fw => {
      const simple = simpleISOWeekStart(fw.year, fw.weekNumber).toISOString().slice(0, 10);
      const cur = fc.get(fw.projectId);
      if (!cur || simple < cur) fc.set(fw.projectId, simple);
    });
    return { real, fc };
  }, [trucks, forecastWeeks]);

  const sortedGanttProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      const ra = projectFirstDate.real.get(a.project.id);
      const rb = projectFirstDate.real.get(b.project.id);
      if (ra && rb) return ra.localeCompare(rb);
      if (ra) return -1;
      if (rb) return 1;
      const fa = projectFirstDate.fc.get(a.project.id);
      const fb = projectFirstDate.fc.get(b.project.id);
      if (fa && fb) return fa.localeCompare(fb);
      if (fa) return -1;
      if (fb) return 1;
      return 0;
    });
  }, [filteredProjects, projectFirstDate]);

  // Aggregations
  const loadByCdt = useMemo(
    () => aggregateTeams(filteredProjects, weeks, p => p.conductor, [UNASSIGNED_CDT]),
    [filteredProjects, weeks],
  );
  const loadByPoseur = useMemo(
    () => aggregateTeams(filteredProjects, weeks, p => p.poseur, [UNASSIGNED_POSEUR]),
    [filteredProjects, weeks],
  );
  const loadByUsine = useMemo(() => {
    const byKey: Record<string, Record<string, number>> = {};
    const projectsByKey: Record<string, Set<string>> = {};
    filteredProjects.forEach(cp => {
      weeks.forEach(w => {
        const cell = cp.weeks[w.key];
        if (!cell || cell.count === 0) return;
        for (const [usine, cats] of Object.entries(cell.byUsineCat)) {
          if (!byKey[usine]) byKey[usine] = {};
          if (!projectsByKey[usine]) projectsByKey[usine] = new Set();
          projectsByKey[usine].add(cp.project.id);
          for (const c of Object.values(cats)) {
            byKey[usine][w.key] = (byKey[usine][w.key] || 0) + c;
          }
        }
      });
    });
    const rows = Object.entries(byKey).map(([key, perWeek]) => ({
      key, perWeek, projectIds: Array.from(projectsByKey[key] || []),
    }));
    return sortWithSentinelLast(rows, r => r.key, [UNASSIGNED_USINE]);
  }, [filteredProjects, weeks]);

  // Cumulative dropdowns — values available given other active filters
  const allCdts = useMemo(() => {
    const list = computedProjects.filter(cp => filterFn(cp, 'cdt')).map(p => p.conductor);
    return sortWithSentinelLast(Array.from(new Set(list)), s => s, [UNASSIGNED_CDT]);
  }, [computedProjects, filterFn]);
  const allPoseurs = useMemo(() => {
    const list = computedProjects.filter(cp => filterFn(cp, 'poseur')).map(p => p.poseur);
    return sortWithSentinelLast(Array.from(new Set(list)), s => s, [UNASSIGNED_POSEUR]);
  }, [computedProjects, filterFn]);
  const allUsines = useMemo(() => {
    const s = new Set<string>();
    computedProjects.filter(cp => filterFn(cp, 'usine')).forEach(p => p.usines.forEach(u => s.add(u)));
    return sortWithSentinelLast(Array.from(s), x => x, [UNASSIGNED_USINE]);
  }, [computedProjects, filterFn]);
  const availableStatus = useMemo(() => {
    const set = new Set<'planned' | 'forecast'>();
    computedProjects.filter(cp => filterFn(cp, 'status')).forEach(cp => {
      const sources = Object.values(cp.weeks).map(w => w.source).filter(s => s !== 'none');
      if (sources.includes('real')) set.add('planned');
      if (sources.length > 0 && !sources.every(s => s === 'real')) set.add('forecast');
    });
    return set;
  }, [computedProjects, filterFn]);

  const hasActiveFilters =
    filterCdt !== 'all' || filterPoseur !== 'all' || filterUsine !== 'all' ||
    filterStatus !== 'all' || searchText.trim() !== '';

  const updateProjectField = useCallback(async (projectId: string, field: 'conductor' | 'subcontractor', value: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, [field]: value } : p));
    const { error } = await supabase.from('projects').update({ [field]: value } as any).eq('id', projectId);
    if (error) toast.error('Erreur sauvegarde : ' + error.message);
    else toast.success('Mise à jour enregistrée');
  }, []);

  const toggleProjectForecastWeek = useCallback(async (projectId: string, year: number, weekNumber: number, teamIndex: number = 0) => {
    const existing = forecastWeeks.find(w => w.projectId === projectId && w.year === year && w.weekNumber === weekNumber && (w.teamIndex ?? 0) === teamIndex);
    if (existing) {
      setForecastWeeks(prev => prev.filter(w => w.id !== existing.id));
      const { error } = await (supabase.from as any)('forecast_weeks').delete().eq('id', existing.id);
      if (error) toast.error('Erreur : ' + error.message);
    } else {
      const id = crypto.randomUUID();
      const nw: ForecastWeek = { id, projectId, year, weekNumber, teamIndex };
      setForecastWeeks(prev => [...prev, nw]);
      const { error } = await (supabase.from as any)('forecast_weeks').insert({
        id, project_id: projectId, year, week_number: weekNumber, team_index: teamIndex,
      });
      if (error) toast.error('Erreur : ' + error.message);
    }
  }, [forecastWeeks]);

  const clearProjectForecastWeeks = useCallback(async (projectId: string) => {
    setForecastWeeks(prev => prev.filter(w => w.projectId !== projectId));
    const { error } = await (supabase.from as any)('forecast_weeks').delete().eq('project_id', projectId);
    if (error) toast.error('Erreur : ' + error.message);
  }, []);

  const setProjectForecastTeamCount = useCallback(async (projectId: string, count: number) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, forecast_team_count: count } : p));
    const { error } = await supabase.from('projects').update({ forecast_team_count: count } as any).eq('id', projectId);
    if (error) toast.error('Erreur : ' + error.message);
  }, []);

  const removeProjectForecastTeam = useCallback(async (projectId: string, teamIndex: number) => {
    if (teamIndex < 1) return;
    const above = forecastWeeks.filter(w => w.projectId === projectId && (w.teamIndex ?? 0) > teamIndex);
    setForecastWeeks(prev => prev
      .filter(w => !(w.projectId === projectId && (w.teamIndex ?? 0) === teamIndex))
      .map(w => (w.projectId === projectId && (w.teamIndex ?? 0) > teamIndex)
        ? { ...w, teamIndex: (w.teamIndex ?? 0) - 1 } : w));
    await (supabase.from as any)('forecast_weeks').delete()
      .eq('project_id', projectId).eq('team_index', teamIndex);
    for (const w of above) {
      await (supabase.from as any)('forecast_weeks').update({ team_index: (w.teamIndex ?? 0) - 1 }).eq('id', w.id);
    }
    const proj = projects.find(p => p.id === projectId);
    const newCount = Math.max(1, (proj?.forecast_team_count ?? 1) - 1);
    await setProjectForecastTeamCount(projectId, newCount);
  }, [forecastWeeks, projects, setProjectForecastTeamCount]);

  const resetFilters = () => {
    setFilterCdt('all'); setFilterPoseur('all'); setFilterUsine('all'); setFilterStatus('all'); setSearchText('');
  };

  const handleExportPdf = async () => {
    try {
      await exportLoadPlanningPdf({ weeks, projects: filteredProjects, loadByCdt, loadByPoseur, loadByUsine, periodStart, periodEnd });
    } catch (err: any) { toast.error('Erreur export PDF : ' + err.message); }
  };

  const handleExportExcel = async () => {
    try {
      await exportLoadPlanningExcel({ weeks, projects: filteredProjects, loadByCdt, loadByPoseur, loadByUsine, periodStart, periodEnd });
    } catch (err: any) { toast.error('Erreur export Excel : ' + err.message); }
  };

  const todayWeekKey = getWeekKeyForDate(today.toISOString().slice(0, 10));

  return (
    <TooltipProvider delayDuration={150}>
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container py-3 flex items-center justify-between gap-4 flex-wrap max-w-none">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-primary-foreground hover:bg-primary-foreground/10">
              <ArrowLeft className="h-4 w-4 mr-1" /> Accueil
            </Button>
            <img src="/logo.png" alt="Logo" className="h-7 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <BarChart3 className="h-6 w-6" />
            <h1 className="text-lg font-bold">Planning de charge</h1>
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
        <Card>
          <CardContent className="pt-4 flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Rechercher par N° OTP, nom de chantier ou client..."
                className="h-9 w-[340px] pr-8"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Effacer la recherche"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={filterCdt} onValueChange={setFilterCdt}>
              <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="CDT" /></SelectTrigger>
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
                {availableStatus.has('planned') && <SelectItem value="planned">Planifiés</SelectItem>}
                {availableStatus.has('forecast') && <SelectItem value="forecast">Prévisionnels</SelectItem>}
              </SelectContent>
            </Select>
            <Button variant={hasActiveFilters ? 'default' : 'outline'} size="sm" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4 mr-1" /> Réinitialiser
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Chargement…</div>
        ) : (
          <>
            <PoseurLegend projects={filteredProjects} />
            <GanttView
              weeks={weeks}
              monthGroups={monthGroups}
              projects={sortedGanttProjects}
              todayKey={todayWeekKey}
              onUpdateField={updateProjectField}
              tokens={tokens}
              forecastWeeks={forecastWeeks}
              onToggleForecastWeek={toggleProjectForecastWeek}
              onClearForecastWeeks={clearProjectForecastWeeks}
              onAddForecastTeam={(pid) => {
                const proj = projects.find(p => p.id === pid);
                setProjectForecastTeamCount(pid, (proj?.forecast_team_count ?? 1) + 1);
              }}
              onRemoveForecastTeam={removeProjectForecastTeam}
            />

            <LoadSummary
              title="Charge / Conducteur de travaux"
              subtitle="Équipes de pose / semaine"
              rows={loadByCdt}
              weeks={weeks}
              monthGroups={monthGroups}
              todayKey={todayWeekKey}
              allProjects={filteredProjects}
              groupBy="cdt"
              sentinels={[UNASSIGNED_CDT]}
            />
            <LoadSummary
              title="Charge / Poseur"
              subtitle="Équipes de pose / semaine"
              rows={loadByPoseur}
              weeks={weeks}
              monthGroups={monthGroups}
              todayKey={todayWeekKey}
              colorByKey={(k) => getPoseurColor(k)}
              allProjects={filteredProjects}
              groupBy="poseur"
              sentinels={[UNASSIGNED_POSEUR]}
            />
            <LoadSummary
              title="Charge / Usine"
              subtitle="Camions / semaine"
              rows={loadByUsine}
              weeks={weeks}
              monthGroups={monthGroups}
              todayKey={todayWeekKey}
              allProjects={filteredProjects}
              groupBy="usine"
              sentinels={[UNASSIGNED_USINE]}
              ceil
            />
          </>
        )}
      </main>
    </div>
    </TooltipProvider>
  );
}

function aggregateTeams(
  projects: ProjectComputed[],
  weeks: ISOWeek[],
  keyFn: (p: ProjectComputed) => string,
  sentinels: string[],
): { key: string; perWeek: Record<string, number>; projectIds: string[] }[] {
  const map: Record<string, Record<string, number>> = {};
  const projIds: Record<string, Set<string>> = {};
  projects.forEach(p => {
    const k = keyFn(p);
    if (!map[k]) map[k] = {};
    if (!projIds[k]) projIds[k] = new Set();
    let projHasAny = false;
    weeks.forEach(w => {
      const t = p.weeks[w.key]?.teams || 0;
      if (t) {
        map[k][w.key] = (map[k][w.key] || 0) + t;
        projHasAny = true;
      }
    });
    if (projHasAny) projIds[k].add(p.project.id);
  });
  const rows = Object.entries(map).map(([key, perWeek]) => ({
    key, perWeek, projectIds: Array.from(projIds[key] || []),
  }));
  return sortWithSentinelLast(rows, r => r.key, sentinels);
}

function MonthsHeader({ monthGroups, leftColSpan }: { monthGroups: MonthGroup[]; leftColSpan: number }) {
  return (
    <tr>
      <th colSpan={leftColSpan} className="sticky left-0 bg-background z-10 border-b" />
      {monthGroups.map((g, i) => (
        <th
          key={i}
          colSpan={g.weeks.length}
          className="p-1 border-b border-l text-center text-[11px] font-semibold capitalize bg-muted/40"
        >
          {g.label}
        </th>
      ))}
    </tr>
  );
}

function WeekHeaderCells({
  weeks, monthGroups, todayKey,
}: { weeks: ISOWeek[]; monthGroups: MonthGroup[]; todayKey: string }) {
  const splitKeys = useMemo(() => {
    const s = new Set<string>();
    monthGroups.forEach(g => g.splitWeekKeys.forEach(k => s.add(k)));
    return s;
  }, [monthGroups]);
  const rangeByKey = useMemo(() => {
    const m: Record<string, { from: string; to: string }> = {};
    monthGroups.forEach(g => Object.assign(m, g.weekRange));
    return m;
  }, [monthGroups]);
  return (
    <>
      {weeks.map(w => {
        const isSplit = splitKeys.has(w.key);
        const r = rangeByKey[w.key];
        const cls = `p-1 border-b text-center font-normal w-[36px] ${
          w.key === todayKey ? 'bg-accent/20 font-bold' : ''
        } ${isSplit ? 'border-l border-dashed border-l-muted-foreground/60' : ''}`;
        if (!isSplit || !r) return <th key={w.key} className={cls}>{w.label}</th>;
        return (
          <th key={w.key} className={cls}>
            <Tooltip>
              <TooltipTrigger asChild><span className="cursor-help">{w.label}</span></TooltipTrigger>
              <TooltipContent>Du {r.from} au {r.to}</TooltipContent>
            </Tooltip>
          </th>
        );
      })}
    </>
  );
}

function LoadSummary({
  title, subtitle, rows, weeks, monthGroups, todayKey, colorByKey, allProjects, groupBy, sentinels, ceil,
}: {
  title: string;
  subtitle: string;
  rows: { key: string; perWeek: Record<string, number>; projectIds: string[] }[];
  weeks: ISOWeek[];
  monthGroups: MonthGroup[];
  todayKey: string;
  colorByKey?: (k: string) => string;
  allProjects: ProjectComputed[];
  groupBy: 'cdt' | 'poseur' | 'usine';
  sentinels: string[];
  ceil?: boolean;
}) {
  const fmt = (v: number) => {
    if (!v) return '';
    return ceil ? Math.ceil(v) : Math.round(v * 10) / 10;
  };
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  const projById = useMemo(() => {
    const m = new Map<string, ProjectComputed>();
    allProjects.forEach(p => m.set(p.project.id, p));
    return m;
  }, [allProjects]);
  const firstSentinelIdx = rows.findIndex(r => sentinels.includes(r.key));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-baseline gap-3">
          <span>{title}</span>
          <span className="text-[11px] font-normal text-muted-foreground">{subtitle}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <MonthsHeader monthGroups={monthGroups} leftColSpan={1} />
            <tr>
              <th className="sticky left-0 bg-background z-10 text-left p-1 border-b min-w-[220px]"></th>
              <WeekHeaderCells weeks={weeks} monthGroups={monthGroups} todayKey={todayKey} />
              <th className="sticky right-0 bg-background z-10 text-center p-1 border-b border-l min-w-[50px] font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={weeks.length + 2} className="p-2 text-muted-foreground italic">Aucune donnée</td></tr>
            )}
            {rows.map((r, idx) => {
              const isOpen = expanded.has(r.key);
              const isSentinel = sentinels.includes(r.key);
              const sepRow = isSentinel && idx === firstSentinelIdx && idx > 0;
              const rowTotal = weeks.reduce((s, w) => s + (r.perWeek[w.key] || 0), 0);
              return (
                <Fragment key={r.key}>
                  {sepRow && (
                    <tr>
                      <td colSpan={weeks.length + 2} className="border-t border-border p-0 h-[2px]" />
                    </tr>
                  )}
                  <tr
                    className="cursor-pointer select-none hover:bg-muted/20"
                    onDoubleClick={() => toggle(r.key)}
                  >
                    <td className="sticky left-0 bg-background z-10 p-1 border-b font-medium">
                      <div className="flex items-center gap-1">
                        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {colorByKey && <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colorByKey(r.key) }} />}
                        <span>{r.key}</span>
                      </div>
                    </td>
                    {weeks.map(w => {
                      const v = r.perWeek[w.key] || 0;
                      return (
                        <td key={w.key} className={`p-1 border-b text-center ${w.key === todayKey ? 'bg-accent/10' : ''}`}>
                          {fmt(v)}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 bg-background z-10 p-1 border-b border-l text-center font-bold">
                      {fmt(rowTotal)}
                    </td>
                  </tr>
                  {isOpen && r.projectIds.map(pid => {
                    const cp = projById.get(pid);
                    if (!cp) return null;
                    const subTotal = weeks.reduce((s, w) => {
                      const cell = cp.weeks[w.key];
                      if (!cell) return s;
                      if (groupBy === 'usine') {
                        const cats = cell.byUsineCat[r.key];
                        return s + (cats ? Object.values(cats).reduce((a, b) => a + b, 0) : 0);
                      }
                      return s + cell.count;
                    }, 0);
                    return (
                      <tr key={`${r.key}-${pid}`} className="bg-muted/30 text-[10px]">
                        <td className="sticky left-0 bg-muted/30 z-10 p-1 pl-6 border-b text-muted-foreground">
                          {(cp.project.otp_number || '—')} — {cp.project.site_name || 'Sans nom'}
                        </td>
                        {weeks.map(w => {
                          const cell = cp.weeks[w.key];
                          let v = 0;
                          if (cell) {
                            if (groupBy === 'usine') {
                              const cats = cell.byUsineCat[r.key];
                              if (cats) v = Object.values(cats).reduce((a, b) => a + b, 0);
                            } else {
                              v = cell.count;
                            }
                          }
                          return (
                            <td key={w.key} className={`p-1 border-b text-center ${w.key === todayKey ? 'bg-accent/10' : ''}`}>
                              {fmt(v)}
                            </td>
                          );
                        })}
                        <td className="sticky right-0 bg-muted/30 z-10 p-1 border-b border-l text-center font-semibold">
                          {fmt(subTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
            {rows.length > 0 && (() => {
              const totals: Record<string, number> = {};
              weeks.forEach(w => {
                let s = 0;
                rows.forEach(r => { s += r.perWeek[w.key] || 0; });
                totals[w.key] = s;
              });
              const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
              const max = Math.max(0, ...Object.values(totals));
              return (
                <tr className="font-bold bg-muted/40">
                  <td className="sticky left-0 bg-muted/40 z-10 p-1 border-t">Total</td>
                  {weeks.map(w => {
                    const v = totals[w.key];
                    return (
                      <td key={w.key} className="p-1 border-t text-center" style={heatStyle(v, max)}>
                        {fmt(v)}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 bg-muted/40 z-10 p-1 border-t border-l text-center">
                    {fmt(grandTotal)}
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function GanttView({
  weeks, monthGroups, projects, todayKey, onUpdateField,
  tokens, forecastWeeks, onToggleForecastWeek, onClearForecastWeeks,
  onAddForecastTeam, onRemoveForecastTeam,
}: {
  weeks: ISOWeek[];
  monthGroups: MonthGroup[];
  projects: ProjectComputed[];
  todayKey: string;
  onUpdateField: (id: string, field: 'conductor' | 'subcontractor', v: string) => void;
  tokens: Record<string, string>;
  forecastWeeks: ForecastWeek[];
  onToggleForecastWeek: (projectId: string, year: number, weekNumber: number, teamIndex?: number) => void;
  onClearForecastWeeks: (projectId: string) => void;
  onAddForecastTeam: (projectId: string) => void;
  onRemoveForecastTeam: (projectId: string, teamIndex: number) => void;
}) {
  const [editing, setEditing] = useState<{ id: string; field: 'conductor' | 'subcontractor' } | null>(null);
  const [popoverProjectId, setPopoverProjectId] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Planning Gantt</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <MonthsHeader monthGroups={monthGroups} leftColSpan={3} />
            <tr>
              <th className="sticky left-0 bg-background z-10 text-left p-1 border-b min-w-[280px]">Chantier</th>
              <th className="sticky left-[280px] bg-background z-10 text-left p-1 border-b min-w-[160px]">CDT</th>
              <th className="sticky left-[440px] bg-background z-10 text-left p-1 border-b min-w-[140px]">Poseur</th>
              <WeekHeaderCells weeks={weeks} monthGroups={monthGroups} todayKey={todayKey} />
              <th className="sticky right-0 bg-background z-10 text-center p-1 border-b border-l min-w-[50px] font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr><td colSpan={weeks.length + 4} className="p-2 text-muted-foreground italic text-center">Aucun chantier</td></tr>
            )}
            {projects.map(cp => {
              const color = getPoseurColor(cp.poseur);
              const teamCount = (cp.project as any).forecast_team_count ?? 1;
              const projWeeksAll = forecastWeeks.filter(w => w.projectId === cp.project.id);
              const isPopOpen = popoverProjectId === cp.project.id;
              const projectTotal = weeks.reduce((s, w) => s + (cp.weeks[w.key]?.count || 0), 0);
              return (
                <tr key={cp.project.id} className="hover:bg-muted/30">
                  <td
                    className="sticky left-0 bg-background z-10 p-1 border-b cursor-pointer"
                    title="Double-clic pour ouvrir le chantier"
                    onDoubleClick={() => {
                      const tk = tokens[cp.project.id];
                      if (tk) navigate(`/p/${tk}`);
                      else toast.error('Lien projet introuvable');
                    }}
                  >
                    <Popover open={isPopOpen} onOpenChange={(o) => !o && setPopoverProjectId(null)}>
                      <PopoverAnchor asChild>
                        <div>
                          <div className="font-medium truncate max-w-[260px]">{cp.project.site_name || 'Sans nom'}</div>
                          <div className="text-[10px] text-muted-foreground">{cp.project.otp_number || '—'}</div>
                        </div>
                      </PopoverAnchor>
                      <PopoverContent
                        className="w-auto max-w-[95vw] p-3"
                        align="start"
                        side="bottom"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="text-sm font-semibold">
                            Planning prévisionnel — {cp.project.otp_number || '—'} {cp.project.site_name || ''}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setPopoverProjectId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {Array.from({ length: teamCount }).map((_, ti) => {
                            const sel = projWeeksAll.filter(w => (w.teamIndex ?? 0) === ti).map(w => `${w.year}-${w.weekNumber}`);
                            return (
                              <div key={ti} className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <ForecastWeeksStrip
                                    selected={sel}
                                    onToggle={(y, w) => onToggleForecastWeek(cp.project.id, y, w, ti)}
                                  />
                                </div>
                                {ti > 0 && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                      onClick={() => { if (confirm('Supprimer cette équipe ?')) onRemoveForecastTeam(cp.project.id, ti); }}>
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                    <span className="text-xs font-medium w-5 text-center shrink-0">{ti + 1}</span>
                                  </>
                                )}
                                {ti === 0 && teamCount > 1 && (
                                  <span className="text-xs font-medium w-5 text-center shrink-0 ml-7">1</span>
                                )}
                              </div>
                            );
                          })}
                          <div className="flex items-center justify-between pt-1">
                            <Button variant="outline" size="sm" onClick={() => onAddForecastTeam(cp.project.id)}>
                              + Équipe
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => onClearForecastWeeks(cp.project.id)}>
                              Tout désélectionner
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
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
                      <span className="cursor-pointer" title="Double-clic pour modifier">{cp.conductor}</span>
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
                      <td
                        key={w.key}
                        className={`p-0 border-b text-center align-middle cursor-pointer ${w.key === todayKey ? 'bg-accent/10' : ''}`}
                        onDoubleClick={(e) => { e.stopPropagation(); setPopoverProjectId(cp.project.id); }}
                        title="Double-clic pour modifier le planning prévisionnel"
                      >
                        {v > 0 && (
                          <div
                            className="text-[10px] font-bold py-1 mx-0.5 rounded-sm"
                            title={`${cp.project.site_name} — ${w.label}: ${v} camion(s) ${isForecast ? '(prévisionnel)' : '(réel)'}`}
                            style={{
                              background: isForecast
                                ? `repeating-linear-gradient(45deg, ${color}, ${color} 4px, rgba(255,255,255,0.45) 4px, rgba(255,255,255,0.45) 8px)`
                                : color,
                              opacity: 1,
                              color: isForecast ? '#1f2937' : '#ffffff',
                            }}
                          >
                            {isForecast ? (
                              <span style={{ background: 'rgba(255,255,255,0.75)', padding: '1px 3px', borderRadius: 2 }}>
                                {Math.ceil(v)}
                              </span>
                            ) : (
                              <>{Math.ceil(v)}</>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 bg-background z-10 p-1 border-b border-l text-center font-bold">
                    {projectTotal > 0 ? Math.ceil(projectTotal) : ''}
                  </td>
                </tr>
              );
            })}
            {projects.length > 0 && (() => {
              const totals: Record<string, number> = {};
              weeks.forEach(w => {
                let s = 0;
                projects.forEach(cp => { s += cp.weeks[w.key]?.count || 0; });
                totals[w.key] = s;
              });
              const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
              const max = Math.max(0, ...Object.values(totals));
              return (
                <tr className="font-bold bg-muted/40">
                  <td colSpan={3} className="sticky left-0 bg-muted/40 z-10 p-1 border-t">Total camions</td>
                  {weeks.map(w => {
                    const v = totals[w.key];
                    return (
                      <td key={w.key} className="p-1 border-t text-center" style={heatStyle(v, max)}>
                        {v ? Math.ceil(v) : ''}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 bg-muted/40 z-10 p-1 border-t border-l text-center">
                    {grandTotal ? Math.ceil(grandTotal) : ''}
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
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
