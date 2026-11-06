import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import XLSX from 'xlsx-js-style';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DebouncedTextarea } from '@/components/ui/debounced-input';
import { Skeleton } from '@/components/ui/skeleton';
import CautionMultiFilter from '@/components/delivery/CautionMultiFilter';
import { ArrowLeft, ArrowUpDown, BarChart3, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AdvStatus, AdvCautionCustom, CAUTION_STATUSES, DEMARCHE_LABELS, getDefaultAdv, getStatusColor } from '@/utils/adv';
import { updateCautionStatus } from '@/utils/cautionStatus';
import { automaticExpiry, buildCautionsWorkbook, CautionExportRow, CautionTracking, emptyTracking, fetchPaginated, isOverdue, TRACKING_COLUMNS, VISIBLE_CAUTION_STATUSES } from '@/utils/cautionTracking';

const sb = supabase as any;
interface ProjectRow { id: string; otp_number: string; site_name: string; archived: boolean; supply_only: boolean }
interface Row extends CautionExportRow { key: string; token?: string }
type DateField = 'date_demande' | 'date_obtention' | 'date_echeance';
type SortField = 'chantier' | 'caution' | 'statut' | DateField | 'commentaire';
const dateLabels: Record<DateField, string> = { date_demande: 'Date de demande', date_obtention: "Date d’obtention", date_echeance: "Date d’échéance" };

export default function AdvCautions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [advs, setAdvs] = useState<AdvStatus[]>([]);
  const [custom, setCustom] = useState<AdvCautionCustom[]>([]);
  const [tracking, setTracking] = useState<CautionTracking[]>([]);
  const [links, setLinks] = useState<{ project_id: string; token: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [commentSearch, setCommentSearch] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedCautions, setSelectedCautions] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [overdue, setOverdue] = useState(false);
  const [sort, setSort] = useState<{ field: SortField; desc: boolean }>({ field: 'date_echeance', desc: false });

  const load = useCallback(async () => {
    try {
      const [p, a, c, t, l] = await Promise.all([
        fetchPaginated<ProjectRow>(() => sb.from('projects').select('id, otp_number, site_name, archived, supply_only').order('id')),
        fetchPaginated<AdvStatus>(() => sb.from('adv_status').select('id, project_id, compte_client, garantie_sfac, contrat_client, caution_rg, contrat_st, garantie_paiement_st, dast, commentaire').order('id')),
        fetchPaginated<AdvCautionCustom>(() => sb.from('adv_cautions_custom').select('id, project_id, nom, statut').order('id')),
        fetchPaginated<CautionTracking>(() => sb.from('adv_caution_tracking').select(TRACKING_COLUMNS).order('id')),
        fetchPaginated<{ project_id: string; token: string }>(() => sb.from('project_access_links').select('project_id, token').order('id')),
      ]);
      setProjects(p); setAdvs(a); setCustom(c); setTracking(t); setLinks(l); setFailed(false);
    } catch { setFailed(true); toast.error('Impossible de charger le suivi des cautions'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load();
    const channel = supabase.channel(`caution-focus-${crypto.randomUUID()}`).on('postgres_changes' as any, { event: '*', schema: 'public', table: 'adv_status' }, load)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'adv_cautions_custom' }, load)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'adv_caution_tracking' }, load).subscribe();
    const refresh = () => { load(); }; window.addEventListener('focus', refresh);
    return () => { supabase.removeChannel(channel); window.removeEventListener('focus', refresh); };
  }, [load]);

  const rows = useMemo<Row[]>(() => {
    const advMap = new Map(advs.map(a => [a.project_id, a]));
    const trackingMap = new Map(tracking.map(t => [`${t.project_id}:${t.caution_key}`, t]));
    const linkMap = new Map(links.map(l => [l.project_id, l.token]));
    const customMap = new Map<string, AdvCautionCustom[]>();
    custom.forEach(c => customMap.set(c.project_id, [...(customMap.get(c.project_id) || []), c]));
    return projects.flatMap(p => {
      const a = advMap.get(p.id) || getDefaultAdv(p.supply_only);
      const cautions = [{ key: 'caution_rg', label: 'Caution RG', statut: a.caution_rg },
        { key: 'garantie_paiement_st', label: 'Garantie de paiement ST', statut: a.garantie_paiement_st },
        ...(customMap.get(p.id) || []).map(c => ({ key: `custom:${c.id}`, label: c.nom || 'Caution supplémentaire', statut: c.statut }))];
      return cautions.filter(c => VISIBLE_CAUTION_STATUSES.includes(c.statut)).map(c => ({
        ...(trackingMap.get(`${p.id}:${c.key}`) || emptyTracking(p.id, c.key)), key: `${p.id}:${c.key}`,
        chantier: [p.otp_number, p.site_name].filter(Boolean).join(' - ') || 'Sans nom', caution: c.label,
        statut: c.statut, archived: p.archived, token: linkMap.get(p.id),
      }));
    });
  }, [projects, advs, custom, tracking, links]);

  const matches = (r: Row, omit = '') => {
    if (search && !r.chantier.toLocaleLowerCase().includes(search.toLocaleLowerCase())) return false;
    if (commentSearch && !r.commentaire.toLocaleLowerCase().includes(commentSearch.toLocaleLowerCase())) return false;
    if (omit !== 'project' && selectedProjects.length && !selectedProjects.includes(r.project_id)) return false;
    if (omit !== 'caution' && selectedCautions.length && !selectedCautions.includes(r.caution)) return false;
    if (omit !== 'status' && selectedStatuses.length && !selectedStatuses.includes(r.statut)) return false;
    if (overdue && !isOverdue(r.date_echeance)) return false;
    return true;
  };
  const filtered = rows.filter(r => matches(r)).sort((a, b) => {
    const av = a[sort.field] || ''; const bv = b[sort.field] || '';
    if (sort.field.startsWith('date_') && (!av || !bv)) return av ? -1 : bv ? 1 : a.key.localeCompare(b.key);
    return av.localeCompare(bv, 'fr') * (sort.desc ? -1 : 1) || a.key.localeCompare(b.key);
  });
  const options = (kind: string) => {
    const available = rows.filter(r => matches(r, kind));
    const map = new Map(available.map(r => kind === 'project' ? [r.project_id, r.chantier] : kind === 'caution' ? [r.caution, r.caution] : [r.statut, r.statut]));
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  };
  const active = !!(search || commentSearch || selectedProjects.length || selectedCautions.length || selectedStatuses.length || overdue || Object.values(periods).some(p => p.some(Boolean)));
  const save = async (row: Row, changes: Partial<CautionTracking>) => {
    const payload = { ...emptyTracking(row.project_id, row.caution_key), date_demande: row.date_demande,
      date_obtention: row.date_obtention, date_echeance: row.date_echeance, echeance_manuelle: row.echeance_manuelle, commentaire: row.commentaire, ...changes };
    if (!payload.echeance_manuelle) payload.date_echeance = automaticExpiry(payload.date_obtention);
    const { data, error } = await sb.from('adv_caution_tracking').upsert(payload, { onConflict: 'project_id,caution_key' }).select(TRACKING_COLUMNS).single();
    if (error) { toast.error('La modification n’a pas été enregistrée'); return; }
    setTracking(prev => [...prev.filter(t => t.project_id !== row.project_id || t.caution_key !== row.caution_key), data]);
  };
  const heading = (field: SortField, label: string) => <th key={field} className="p-2 text-left"><Button variant="ghost" size="sm" className="px-0 whitespace-nowrap" onClick={() => setSort({ field, desc: sort.field === field ? !sort.desc : false })}>{label}<ArrowUpDown className="ml-1 h-3 w-3" /></Button></th>;

  return <div className="min-h-screen bg-background">
    <header className="bg-primary text-primary-foreground shadow-lg"><div className="container py-3 flex flex-wrap items-center gap-3">
      <img src="/logo.png" alt="RECTOR" className="h-8 object-contain" /><ShieldCheck className="h-6 w-6" />
      <h1 className="text-lg font-bold flex-1">Suivi des cautions</h1>
      <Button variant="secondary" size="sm" onClick={() => navigate('/adv')}><ArrowLeft className="mr-2 h-4 w-4" />Retour au tableau de bord ADV</Button>
      <Button variant="secondary" size="sm" onClick={() => navigate('/planning-charge')}><BarChart3 className="mr-2 h-4 w-4" />Planning de charge</Button>
    </div></header>
    <main className="container py-4 space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input aria-label="Recherche chantier" placeholder="Rechercher OTP, chantier…" value={search} onChange={e => setSearch(e.target.value)} className="w-60 h-9" />
        <CautionMultiFilter label="Chantier" options={options('project')} selected={selectedProjects} onChange={setSelectedProjects} />
        <CautionMultiFilter label="Caution" options={options('caution')} selected={selectedCautions} onChange={setSelectedCautions} />
        <CautionMultiFilter label="Statut" options={options('status')} selected={selectedStatuses} onChange={setSelectedStatuses} />
        <Input aria-label="Filtrer commentaire" placeholder="Commentaire…" value={commentSearch} onChange={e => setCommentSearch(e.target.value)} className="w-52 h-9" />
        <Button variant={active ? 'default' : 'outline'} size="sm" onClick={() => { setSearch(''); setCommentSearch(''); setSelectedProjects([]); setSelectedCautions([]); setSelectedStatuses([]); setPeriods(blankPeriods()); setOverdue(false); }}>Réinitialiser</Button>
      </div>
      <div className="flex flex-wrap gap-4 items-end">{(Object.keys(dateLabels) as DateField[]).map(field => <fieldset key={field} className="space-y-1"><legend className="text-xs font-medium">{dateLabels[field]}</legend><div className="flex items-center gap-2 text-xs">
        {['Du', 'au'].map((label, i) => <label key={label} className="flex items-center gap-1">{label}<Input type="date" aria-label={`${dateLabels[field]} ${label}`} value={periods[field][i]} className={`h-8 w-36 ${periods[field].some(Boolean) ? 'border-primary bg-secondary' : ''}`} onChange={e => setPeriods(prev => ({ ...prev, [field]: prev[field].map((v, index) => index === i ? e.target.value : v) }))} /></label>)}
      </div></fieldset>)}<label className={`flex items-center gap-2 text-sm ${overdue ? 'text-destructive font-semibold' : ''}`}><Checkbox checked={overdue} onCheckedChange={v => setOverdue(v === true)} />Échéance dépassée</label></div>
      <div className="flex items-center justify-between"><span className="font-semibold">{filtered.length} caution{filtered.length > 1 ? 's' : ''}</span><Button size="sm" variant="outline" disabled={loading || failed} onClick={() => XLSX.writeFile(buildCautionsWorkbook(filtered), `suivi_cautions_${format(new Date(), 'dd-MM-yyyy')}.xlsx`)}><FileSpreadsheet className="h-4 w-4 mr-2" />Exporter Excel</Button></div>
      {loading ? <Skeleton className="h-64 w-full" /> : failed ? <Button variant="outline" onClick={load}>Réessayer</Button> : <div className="overflow-auto max-h-[75vh]"><table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-secondary text-secondary-foreground"><tr>{heading('chantier', 'Chantier')}{heading('caution', 'Caution')}{heading('statut', 'Statut')}{(Object.keys(dateLabels) as DateField[]).map(f => heading(f, dateLabels[f]))}{heading('commentaire', 'Commentaire')}</tr></thead>
        <tbody>{filtered.map(r => <tr key={r.key} className="border-b hover:bg-muted/50">
          <td className="p-2 min-w-48"><Button variant="link" className="p-0 h-auto text-left whitespace-normal justify-start" onClick={() => r.token ? navigate(`/p/${r.token}?tab=adv`) : toast.error('Lien chantier introuvable')}>{r.chantier}</Button>{r.archived && <span className="ml-2 text-xs text-muted-foreground border rounded px-1">Archivé</span>}</td>
          <td className="p-2">{r.caution}</td><td className="p-2 whitespace-nowrap"><span className={`inline-block h-2.5 w-2.5 rounded-full mr-2 adv-dot-${getStatusColor(r.statut)}`} />{r.statut}</td>
          {(Object.keys(dateLabels) as DateField[]).map(field => <td key={field} className="p-2"><div className="flex items-center gap-1"><Input type="date" aria-label={`${dateLabels[field]} — ${r.chantier} — ${r.caution}`} value={r[field] || ''} onChange={e => save(r, { [field]: e.target.value || null, ...(field === 'date_echeance' ? { echeance_manuelle: true } : {}) })} className={`h-8 w-36 ${field === 'date_echeance' && isOverdue(r.date_echeance) ? 'text-destructive font-bold' : ''}`} />{field === 'date_echeance' && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Recalculer (+1 an)" aria-label={`Recalculer (+1 an) — ${r.chantier} — ${r.caution}`} onClick={() => save(r, { echeance_manuelle: false })}><RotateCcw className="h-3.5 w-3.5" /></Button>}</div></td>)}
          <td className="p-2 min-w-52"><DebouncedTextarea aria-label={`Commentaire — ${r.chantier} — ${r.caution}`} rows={2} value={r.commentaire} onCommit={value => save(r, { commentaire: value })} className="min-h-12 text-sm" /></td>
        </tr>)}{!filtered.length && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Aucune caution.</td></tr>}</tbody>
      </table></div>}
    </main>
  </div>;
}