import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Home, ClipboardCheck, FileSpreadsheet, Search, AlertTriangle, ArrowUpRight, BarChart3 } from 'lucide-react';
import { setISOWeek, setISOWeekYear, startOfISOWeek, differenceInCalendarDays, parseISO, format } from 'date-fns';
import {
  AdvStatus, AdvCautionCustom, AdvRelance, AdvDemarcheKey, DEMARCHE_LABELS,
  calculateAdvScore, getScoreHexColor, getScoreColorClass,
  effectiveRelanceStatus, isDemarcheFinal, getApplicableDemarches, formatDateFR,
} from '@/utils/adv';
import { formatCDTLabel } from '@/utils/supplyOnly';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const sb = supabase as any;

interface ProjectRow {
  id: string;
  site_name: string | null;
  client_name: string | null;
  otp_number: string | null;
  conductor: string | null;
  subcontractor: string | null;
  business_manager: string | null;
  archived: boolean;
  supply_only: boolean;
}
interface TruckLite { project_id: string; date: string }
interface ForecastWeekLite { project_id: string; year: number; week_number: number }
interface AccessLink { project_id: string; token: string }

type Badge = 'Critique' | 'Important' | 'À compléter' | 'Conforme';

function badgeOf(score: number, startDate: Date | null): Badge {
  if (score >= 99) return 'Conforme';
  if (!startDate) return 'À compléter';
  const days = differenceInCalendarDays(startDate, new Date());
  if (days <= 7) return 'Critique';
  if (days <= 15) return 'Important';
  return 'À compléter';
}

function badgeColor(b: Badge): string {
  if (b === 'Critique') return 'bg-red-100 text-red-700 border-red-300';
  if (b === 'Important') return 'bg-orange-100 text-orange-700 border-orange-300';
  if (b === 'Conforme') return 'bg-green-100 text-green-700 border-green-300';
  return 'bg-gray-100 text-gray-700 border-gray-300';
}

function isoWeekMonday(year: number, week: number): Date {
  return startOfISOWeek(setISOWeek(setISOWeekYear(new Date(year, 0, 4), year), week));
}

export default function AdvDashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [advs, setAdvs] = useState<AdvStatus[]>([]);
  const [cautions, setCautions] = useState<AdvCautionCustom[]>([]);
  const [relances, setRelances] = useState<AdvRelance[]>([]);
  const [trucks, setTrucks] = useState<TruckLite[]>([]);
  const [forecastWeeks, setForecastWeeks] = useState<ForecastWeekLite[]>([]);
  const [links, setLinks] = useState<AccessLink[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCdt, setFilterCdt] = useState('all');
  const [filterPoseur, setFilterPoseur] = useState('all');
  const [filterCda, setFilterCda] = useState('all');
  const [filterBadge, setFilterBadge] = useState<'all' | Badge>('all');
  
  const [filterDemarche, setFilterDemarche] = useState<string>('all');
  const [filterDemarcheStatut, setFilterDemarcheStatut] = useState<string>('all');

  const demarcheLabelsExt: Record<string, string> = {
    compte_client: 'Compte client',
    garantie_sfac: 'Garantie bancaire (SFAC)',
    contrat_client: 'Contrat client',
    caution_rg: 'Caution Retenue de garantie',
    contrat_st: 'Contrat sous-traitant',
    dast: 'DAST',
    caution_supplementaire: 'Caution supplémentaire',
  };
  const demarcheStatusOptions: Record<string, string[]> = {
    compte_client: ['À ouvrir', 'Demande effectuée', 'Ouvert'],
    garantie_sfac: ['À demander', 'Demandée', 'Accord obtenu', 'Refusée'],
    contrat_client: ['Non reçu', 'Envoyé', 'Signé'],
    caution_rg: ['Non nécessaire', 'À demander', 'Demandée', 'Obtenue'],
    contrat_st: ['Non nécessaire', 'En attente devis poseur', 'Contrat envoyé', 'Contrat signé'],
    dast: ['Non nécessaire', 'À préparer', 'Envoyée', 'Acceptée', 'Refusée'],
    caution_supplementaire: ['Non nécessaire', 'À demander', 'Demandée', 'Obtenue'],
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [p, a, c, r, t, fw, lk] = await Promise.all([
        supabase.from('projects').select('id, site_name, client_name, otp_number, conductor, subcontractor, business_manager, archived, supply_only').eq('archived', false),
        sb.from('adv_status').select('*'),
        sb.from('adv_cautions_custom').select('*'),
        sb.from('adv_relances').select('*'),
        supabase.from('trucks').select('project_id, date'),
        sb.from('forecast_weeks').select('project_id, year, week_number'),
        supabase.from('project_access_links').select('project_id, token'),
      ]);
      setProjects((p.data || []) as ProjectRow[]);
      setAdvs((a.data || []) as AdvStatus[]);
      setCautions((c.data || []) as AdvCautionCustom[]);
      setRelances((r.data || []) as AdvRelance[]);
      setTrucks((t.data || []) as TruckLite[]);
      setForecastWeeks((fw.data || []) as ForecastWeekLite[]);
      setLinks((lk.data || []) as AccessLink[]);
      setLoading(false);
    })();
  }, []);

  const advByProject = useMemo(() => {
    const m = new Map<string, AdvStatus>();
    advs.forEach(a => m.set(a.project_id, a));
    return m;
  }, [advs]);

  const cautionsByProject = useMemo(() => {
    const m = new Map<string, AdvCautionCustom[]>();
    cautions.forEach(c => {
      if (!m.has(c.project_id)) m.set(c.project_id, []);
      m.get(c.project_id)!.push(c);
    });
    return m;
  }, [cautions]);

  const startDateByProject = useMemo(() => {
    const m = new Map<string, Date>();
    const truckMin = new Map<string, string>();
    trucks.forEach(t => {
      if (!t.date) return;
      const cur = truckMin.get(t.project_id);
      if (!cur || t.date < cur) truckMin.set(t.project_id, t.date);
    });
    truckMin.forEach((d, pid) => m.set(pid, parseISO(d)));
    // fallback: forecast
    const fcMin = new Map<string, Date>();
    forecastWeeks.forEach(f => {
      const d = isoWeekMonday(f.year, f.week_number);
      const cur = fcMin.get(f.project_id);
      if (!cur || d < cur) fcMin.set(f.project_id, d);
    });
    fcMin.forEach((d, pid) => { if (!m.has(pid)) m.set(pid, d); });
    return m;
  }, [trucks, forecastWeeks]);

  const linkByProject = useMemo(() => {
    const m = new Map<string, string>();
    links.forEach(l => m.set(l.project_id, l.token));
    return m;
  }, [links]);

  const rows = useMemo(() => {
    return projects.map(p => {
      const adv = advByProject.get(p.id);
      const cs = cautionsByProject.get(p.id) || [];
      const score = calculateAdvScore(adv as any, cs);
      const startDate = startDateByProject.get(p.id) || null;
      const badge = badgeOf(score, startDate);
      const cdt = formatCDTLabel(p.conductor) || '—';
      const poseur = p.supply_only ? 'Fourniture seule' : (p.subcontractor || 'Poseur à désigner');
      const cda = (p.business_manager || '').trim();
      return { project: p, adv, cautions: cs, score, startDate, badge, cdt, poseur, cda };
    });
  }, [projects, advByProject, cautionsByProject, startDateByProject]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const s = search.toLowerCase();
      if (s && !(r.project.site_name || '').toLowerCase().includes(s)
        && !(r.project.otp_number || '').toLowerCase().includes(s)
        && !(r.project.client_name || '').toLowerCase().includes(s)) return false;
      if (filterCdt !== 'all' && r.cdt !== filterCdt) return false;
      if (filterPoseur !== 'all' && r.poseur !== filterPoseur) return false;
      if (filterCda !== 'all') {
        if (filterCda === '__unassigned__') { if (r.cda) return false; }
        else if (r.cda !== filterCda) return false;
      }
      if (filterBadge !== 'all' && r.badge !== filterBadge) return false;
      if (filterDemarche !== 'all' && filterDemarcheStatut !== 'all') {
        if (filterDemarche === 'caution_supplementaire') {
          if (!r.cautions.some(c => c.statut === filterDemarcheStatut)) return false;
        } else {
          if (!r.adv) return false;
          if ((r.adv as any)[filterDemarche] !== filterDemarcheStatut) return false;
        }
      }
      return true;
    }).sort((a, b) => {
      const ta = a.startDate?.getTime() ?? Infinity;
      const tb = b.startDate?.getTime() ?? Infinity;
      return ta - tb;
    });
  }, [rows, search, filterCdt, filterPoseur, filterCda, filterBadge, filterDemarche, filterDemarcheStatut]);

  const cdtOptions = useMemo(() => Array.from(new Set(rows.map(r => r.cdt).filter(c => c && c !== '—'))).sort(), [rows]);
  const poseurOptions = useMemo(() => Array.from(new Set(rows.map(r => r.poseur))).sort(), [rows]);
  const cdaOptions = useMemo(() => Array.from(new Set(rows.map(r => r.cda).filter(Boolean))).sort(), [rows]);
  const hasUnassignedCda = useMemo(() => rows.some(r => !r.cda), [rows]);

  // KPIs
  const chantiersActifs = rows.length;
  const chantiersRisque = rows.filter(r => r.badge === 'Critique' || r.badge === 'Important').length;
  const actionsEnAttente = rows.reduce((sum, r) => {
    if (!r.adv) return sum;
    const app = getApplicableDemarches(r.adv);
    return sum + app.filter(d => !isDemarcheFinal(d.status)).length;
  }, 0);
  const today = format(new Date(), 'yyyy-MM-dd');
  const relancesEchues = relances.filter(r => r.statut !== 'Traitée' && r.echeance <= today).length;

  const relancesEnCours = useMemo(() => {
    return relances
      .filter(r => r.statut !== 'Traitée')
      .map(r => ({ ...r, effective: effectiveRelanceStatus(r) }))
      .sort((a, b) => a.echeance.localeCompare(b.echeance));
  }, [relances]);

  const chantiersRisqueRows = useMemo(() => {
    return rows
      .filter(r => (r.badge === 'Critique' || r.badge === 'Important') && r.adv)
      .map(r => {
        const pendingDemarches = getApplicableDemarches(r.adv!)
          .filter(d => !isDemarcheFinal(d.status))
          .map(d => ({ label: DEMARCHE_LABELS[d.key], status: d.status, key: d.key as string }));
        const pendingCautions = r.cautions
          .filter(c => c.statut !== 'Non nécessaire' && !isDemarcheFinal(c.statut))
          .map(c => ({ label: c.nom || 'Caution', status: c.statut, key: `caution-${c.id}` }));
        return { ...r, pendingItems: [...pendingDemarches, ...pendingCautions] };
      })
      .filter(r => r.pendingItems.length > 0)
      .sort((a, b) => (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0));
  }, [rows]);

  const openProject = (projectId: string) => {
    const token = linkByProject.get(projectId);
    if (token) navigate(`/p/${token}?tab=adv`);
    else toast.error('Lien chantier introuvable');
  };

  const exportExcel = () => {
    const maxCustom = Math.max(0, ...filteredRows.map(r => r.cautions.length));
    const data = filteredRows.map(r => {
      const p = r.project;
      const adv = r.adv;
      const projRelances = relances.filter(x => x.project_id === p.id && x.statut !== 'Traitée');
      const base: any = {
        OTP: p.otp_number || '',
        'Nom chantier': p.site_name || '',
        Client: p.client_name || '',
        CDT: r.cdt,
        Poseur: r.poseur,
        'Date démarrage': r.startDate ? format(r.startDate, 'dd/MM/yyyy') : '',
        'Score ADV': r.score + '%',
        'Compte client': adv?.compte_client || '',
        'Garantie SFAC': adv?.garantie_sfac || '',
        'Contrat client': adv?.contrat_client || '',
        'Caution RG': adv?.caution_rg || '',
        'Contrat ST': adv?.contrat_st || '',
        DAST: adv?.dast || '',
      };
      for (let i = 0; i < maxCustom; i++) {
        const c = r.cautions[i];
        base[`Caution ${i + 1}`] = c ? `${c.nom} : ${c.statut}` : '';
      }
      base['Relances à réaliser'] = projRelances.map(x => `${x.type} (${formatDateFR(x.echeance)})`).join(' | ');
      base['Commentaire'] = adv?.commentaire || '';
      return base;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Tableau ADV');
    const today = format(new Date(), 'dd-MM-yyyy');
    XLSX.writeFile(wb, `tableau_bord_ADV_${today}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container py-3 flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <ClipboardCheck className="h-7 w-7" />
          <h1 className="text-lg font-bold tracking-tight flex-1">RECTOR – Tableau de bord ADV</h1>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/planning-charge')}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Planning de charge
          </Button>
          <Button variant="ghost" size="sm" className="text-primary-foreground/80 hover:text-primary-foreground" onClick={() => navigate('/')}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="container py-4 space-y-4">
        {loading ? <div className="text-muted-foreground p-8 text-center">Chargement…</div> : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Chantiers actifs" value={chantiersActifs} />
              <KpiCard label="Chantiers à risque" value={chantiersRisque} color="text-orange-600" />
              <KpiCard label="Actions à compléter" value={actionsEnAttente} />
              <KpiCard label="Relances échues" value={relancesEchues} color="text-red-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Chantiers à risque
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 max-h-72 overflow-y-auto">
                  {chantiersRisqueRows.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucun chantier à risque.</p>
                  )}
                  {chantiersRisqueRows.map(r => {
                    const days = r.startDate ? differenceInCalendarDays(r.startDate, new Date()) : null;
                    return (
                      <button key={r.project.id} onClick={() => openProject(r.project.id)}
                        className="w-full text-left py-1.5 px-2 hover:bg-muted rounded text-sm block">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${badgeColor(r.badge)}`}>{r.badge}</span>
                          <span className="flex-1 truncate">
                            {r.project.otp_number && <span className="text-muted-foreground mr-1">{r.project.otp_number}</span>}
                            {r.project.site_name || 'Sans nom'}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {days !== null
                              ? days >= 0 ? `Démarrage dans ${days} j` : `Démarré il y a ${-days} j`
                              : '—'}
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <ul className="mt-0.5 pl-6 text-xs" style={{ color: '#6b7280' }}>
                          {r.pendingItems.map(d => (
                            <li key={d.key}>└ {d.label} : {d.status}</li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className={`text-base ${relancesEnCours.length === 0 ? 'text-muted-foreground' : ''}`}>
                    {relancesEnCours.length} relance{relancesEnCours.length > 1 ? 's' : ''} à réaliser
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-72 overflow-y-auto">
                  {relancesEnCours.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-6 py-4">Aucune relance à réaliser.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 px-6 text-left font-medium text-xs text-muted-foreground">Relance</th>
                          <th className="py-2 px-6 text-center font-medium text-xs text-muted-foreground w-[100px]">Au plus tard</th>
                        </tr>
                      </thead>
                <tbody>
                  {relancesEnCours.map(r => {
                    const p = projects.find(x => x.id === r.project_id);
                    if (!p) return null;
                    let demarcheLabel: string;
                    if (r.demarche === 'caution_custom') {
                      const projectCautions = cautionsByProject.get(r.project_id) || [];
                      const caution = projectCautions.find(c => c.id === r.source_id);
                      demarcheLabel = caution ? caution.nom : 'Caution personnalisée';
                    } else {
                      demarcheLabel = DEMARCHE_LABELS[r.demarche as AdvDemarcheKey] || r.demarche;
                    }
                    return (
                      <tr key={r.id} onClick={() => openProject(p.id)}
                        className="border-b hover:bg-muted cursor-pointer odd:bg-white even:bg-gray-50">
                        <td className="py-1.5 px-6">
                          <span className={`truncate block ${r.effective === 'Échue' ? 'text-red-600 font-medium' : ''}`}>
                            {p.site_name || 'Sans nom'} — {demarcheLabel}
                          </span>
                        </td>
                        <td className="py-1.5 px-6 text-xs tabular-nums text-center w-[100px]">
                          {formatDateFR(r.echeance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="text-base">Tableau des affaires</CardTitle>
                  <Button size="sm" variant="outline" onClick={exportExcel}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Exporter Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3 flex-nowrap overflow-x-auto">
                  <div className="relative flex-shrink-0" style={{ width: 220, minWidth: 180 }}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher OTP, nom, client…" className="pl-9 h-9" />
                  </div>
                  <Select value={filterCdt} onValueChange={setFilterCdt}>
                    <SelectTrigger className={`h-9 flex-shrink-0 ${filterCdt !== 'all' ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : 'hover:bg-accent hover:text-accent-foreground'}`} style={{ width: 160 }}>
                      <SelectValue placeholder="CDT" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les CDT</SelectItem>
                      {cdtOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterPoseur} onValueChange={setFilterPoseur}>
                    <SelectTrigger className={`h-9 flex-shrink-0 ${filterPoseur !== 'all' ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : 'hover:bg-accent hover:text-accent-foreground'}`} style={{ width: 160 }}>
                      <SelectValue placeholder="Poseur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les poseurs</SelectItem>
                      {poseurOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterBadge} onValueChange={(v: any) => setFilterBadge(v)}>
                    <SelectTrigger className={`h-9 flex-shrink-0 ${filterBadge !== 'all' ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : 'hover:bg-accent hover:text-accent-foreground'}`} style={{ width: 140 }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous badges</SelectItem>
                      <SelectItem value="Critique">Critique</SelectItem>
                      <SelectItem value="Important">Important</SelectItem>
                      <SelectItem value="À compléter">À compléter</SelectItem>
                      <SelectItem value="Conforme">Conforme</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Select
                      value={filterDemarche}
                      onValueChange={(v) => { setFilterDemarche(v); setFilterDemarcheStatut('all'); }}
                    >
                      <SelectTrigger className={`h-9 flex-shrink-0 ${filterDemarche !== 'all' ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : 'hover:bg-accent hover:text-accent-foreground'}`} style={{ width: 180 }}>
                        <SelectValue placeholder="Démarche" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes démarches</SelectItem>
                        {Object.entries(demarcheLabelsExt).map(([k, l]) => (
                          <SelectItem key={k} value={k}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {filterDemarche !== 'all' && (
                      <Select value={filterDemarcheStatut} onValueChange={setFilterDemarcheStatut}>
                        <SelectTrigger className={`h-9 flex-shrink-0 ${filterDemarcheStatut !== 'all' ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : 'hover:bg-accent hover:text-accent-foreground'}`} style={{ width: 180 }}>
                          <SelectValue placeholder="Statut" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous statuts</SelectItem>
                          {(demarcheStatusOptions[filterDemarche] || []).map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Button
                    variant={filterCdt !== 'all' || filterPoseur !== 'all' || filterBadge !== 'all' || filterDemarche !== 'all' || filterDemarcheStatut !== 'all' || search ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 flex-shrink-0"
                    onClick={() => { setSearch(''); setFilterCdt('all'); setFilterPoseur('all'); setFilterBadge('all'); setFilterDemarche('all'); setFilterDemarcheStatut('all'); }}
                  >
                    Réinitialiser
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-2">Chantier</th>
                        <th className="py-2 pr-2">CDT</th>
                        <th className="py-2 pr-2">Poseur</th>
                        <th className="py-2 pr-2">Démarrage</th>
                        <th className="py-2 pr-2">Score</th>
                        <th className="py-2 pr-2 w-48">Progression</th>
                        <th className="py-2 pr-2">Alerte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map(r => (
                        <tr key={r.project.id} className="border-b hover:bg-muted/40 cursor-pointer" onClick={() => openProject(r.project.id)}>
                          <td className="py-1.5 pr-2">
                            <div className="font-medium">{r.project.site_name || 'Sans nom'}</div>
                            <div className="text-xs text-muted-foreground">{r.project.otp_number || ''}</div>
                          </td>
                          <td className="py-1.5 pr-2">{r.cdt}</td>
                          <td className="py-1.5 pr-2">{r.poseur}</td>
                          <td className="py-1.5 pr-2 tabular-nums">{r.startDate ? format(r.startDate, 'dd/MM/yyyy') : '—'}</td>
                          <td className={`py-1.5 pr-2 font-medium ${getScoreColorClass(r.score)}`}>{r.score}%</td>
                          <td className="py-1.5 pr-2">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full" style={{ width: `${r.score}%`, backgroundColor: getScoreHexColor(r.score) }} />
                            </div>
                          </td>
                          <td className="py-1.5 pr-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${badgeColor(r.badge)}`}>{r.badge}</span>
                          </td>
                        </tr>
                      ))}
                      {filteredRows.length === 0 && (
                        <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Aucun chantier.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${color || ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}