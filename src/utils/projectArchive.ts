import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { BeamElement, ProjectInfo, Truck, Team, TRANSPORT_CATEGORIES } from '@/types/delivery';
import { getEffectiveCategory } from '@/utils/transportUtils';
import { exportAllWeeksPdf } from '@/utils/pdfExportUtils';
import { exportWeeklyExcelStyled } from '@/utils/weeklyExcelExport';

const sb = supabase as any;

export const ARCHIVE_FORMAT_VERSION = 1;

export interface ProjectBundle {
  formatVersion: number;
  exportedAt: string;
  project: any;
  teams: any[];
  beam_elements: any[];
  trucks: any[];
  plans: any[];
  forecast_weeks: any[];
  forecast_slots: any[];
  forecast_history: any[];
  adv_status: any[];
  adv_cautions_custom: any[];
  adv_relances: any[];
  adv_historique: any[];
}

async function fetchAll(table: string, projectId: string, orderCol = 'id'): Promise<any[]> {
  const PAGE = 1000;
  let all: any[] = [];
  let page = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select('*').eq('project_id', projectId)
      .order(orderCol, { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    page++;
  }
  return all;
}

export async function fetchProjectBundle(projectId: string): Promise<ProjectBundle> {
  const { data: project, error } = await sb.from('projects').select('*').eq('id', projectId).single();
  if (error) throw error;
  const [teams, beam_elements, trucks, plans, forecast_weeks, forecast_slots, forecast_history,
    adv_status, adv_cautions_custom, adv_relances, adv_historique] = await Promise.all([
    fetchAll('teams', projectId),
    fetchAll('beam_elements', projectId),
    fetchAll('trucks', projectId),
    fetchAll('plans', projectId),
    fetchAll('forecast_weeks', projectId),
    fetchAll('forecast_slots', projectId),
    fetchAll('forecast_history', projectId),
    fetchAll('adv_status', projectId),
    fetchAll('adv_cautions_custom', projectId),
    fetchAll('adv_relances', projectId),
    fetchAll('adv_historique', projectId),
  ]);
  return {
    formatVersion: ARCHIVE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    project, teams, beam_elements, trucks, plans, forecast_weeks, forecast_slots,
    forecast_history, adv_status, adv_cautions_custom, adv_relances, adv_historique,
  };
}

function toProjectInfo(p: any): ProjectInfo {
  return {
    otpNumber: p.otp_number || '', siteName: p.site_name || '', clientName: p.client_name || '',
    siteAddress: p.site_address || '', conductor: p.conductor || '', subcontractor: p.subcontractor || '',
    contactName: p.contact_name || '', contactPhone: p.contact_phone || '',
    businessManager: p.business_manager || '',
    showSaturdays: !!p.show_saturdays, showSundays: !!p.show_sundays,
    databaseComplete: !!p.database_complete, databaseComment: p.database_comment || '',
    supplyOnly: !!p.supply_only,
    forecastedTransports: p.forecasted_transports || [],
    forecastPeriodStart: p.forecast_period_start ?? null,
    forecastPeriodEnd: p.forecast_period_end ?? null,
  };
}

function toElement(e: any): BeamElement {
  return {
    id: e.id, repere: e.repere || '', zone: e.zone || '', productType: e.product_type || '',
    section: e.section || '', length: Number(e.length) || 0, weight: Number(e.weight) || 0,
    factory: e.factory || '',
  };
}

function toTruck(t: any): Truck {
  return {
    id: t.id, number: t.number || '', date: t.date || '', time: t.time || '',
    elementIds: (t.element_ids as string[]) || [], comment: t.comment || '',
    teamId: t.team_id || undefined, transporter: t.transporter || undefined,
    handlingMeans: (t.handling_means as Record<string, string>) || {},
    forcedCategory: t.forced_category || undefined,
    forcedCategoryReason: t.forced_category_reason || undefined,
  };
}

function sanitizeName(s: string): string {
  return (s || 'chantier').replace(/[^a-zA-Z0-9À-ÿ_-]+/g, '_').replace(/^_+|_+$/g, '') || 'chantier';
}

function buildDatabaseExcelBlob(elements: BeamElement[], trucks: Truck[], teams: Team[]): Blob {
  const elementTruck = new Map<string, Truck>();
  trucks.forEach(t => t.elementIds.forEach(id => elementTruck.set(id, t)));
  const elementById = new Map(elements.map(e => [e.id, e]));
  const showTeam = teams.length > 1;
  const rows = elements.map(el => {
    const truck = elementTruck.get(el.id);
    const truckEls = truck ? truck.elementIds.map(id => elementById.get(id)).filter(Boolean) as BeamElement[] : [];
    const row: Record<string, string | number> = {
      'N° Repère': el.repere,
      'Zone': el.zone,
      'Type de produit': el.productType,
      'Section': el.section,
      'Longueur (m)': el.length,
      'Poids (t)': el.weight,
      'Usine': el.factory,
      'Numéro camion': truck ? truck.number : '',
      'Date camion': truck?.date ? format(parseISO(truck.date), 'dd/MM/yyyy') : '',
      'Catégorie de transport': truck ? TRANSPORT_CATEGORIES[getEffectiveCategory(truck, truckEls)].label : '',
      'Transporteur': truck?.transporter?.trim() || '',
      'Moyen de manutention': truck?.handlingMeans?.[el.factory] || '',
    };
    if (showTeam) row['Équipe'] = truck?.teamId ? (teams.find(t => t.id === truck.teamId)?.name || '') : '';
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Base de données');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export interface ArchiveContentSummary {
  weeks: number;
  trucks: number;
  elements: number;
  plans: number;
}

export function summarizeBundle(b: ProjectBundle): ArchiveContentSummary {
  const weekKeys = new Set<string>();
  b.trucks.forEach(t => {
    if (!t.date) return;
    const d = parseISO(t.date);
    weekKeys.add(`${d.getFullYear()}-${format(d, 'II')}`);
  });
  return { weeks: weekKeys.size, trucks: b.trucks.length, elements: b.beam_elements.length, plans: b.plans.length };
}

/** Build and download a full ZIP archive of a project. */
export async function exportProjectArchiveZip(projectId: string): Promise<void> {
  const bundle = await fetchProjectBundle(projectId);
  const projectInfo = toProjectInfo(bundle.project);
  const elements = bundle.beam_elements.map(toElement);
  const trucks = bundle.trucks.map(toTruck);
  const teams: Team[] = bundle.teams
    .map(t => ({ id: t.id, projectId: t.project_id, name: t.name, sortOrder: t.sort_order }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const elementById = new Map(elements.map(e => [e.id, e]));
  const getTruckElements = (truckId: string): BeamElement[] => {
    const t = trucks.find(x => x.id === truckId);
    if (!t) return [];
    return t.elementIds.map(id => elementById.get(id)).filter(Boolean) as BeamElement[];
  };

  // Weeks present in the planning, chronological
  const weekMap = new Map<string, { weekNumber: number; year: number }>();
  trucks.forEach(t => {
    if (!t.date) return;
    const d = parseISO(t.date);
    const wn = parseInt(format(d, 'II'));
    const y = d.getFullYear();
    weekMap.set(`${y}-${wn}`, { weekNumber: wn, year: y });
  });
  const weeklyTabs = Array.from(weekMap.values()).sort((a, b) => a.year - b.year || a.weekNumber - b.weekNumber);
  const totalSiteWeight = elements.reduce((s, e) => s + e.weight, 0);

  const zip = new JSZip();
  const base = sanitizeName(projectInfo.siteName || projectInfo.otpNumber || 'chantier');

  if (weeklyTabs.length > 0) {
    const pdfBlob = await exportAllWeeksPdf(
      weeklyTabs, trucks, getTruckElements, projectInfo, totalSiteWeight, trucks,
      elements, '', undefined, teams.map(t => ({ id: t.id, name: t.name })), true,
    );
    if (pdfBlob) zip.file(`planning_complet_${base}.pdf`, pdfBlob);

    const xlsxBlob = exportWeeklyExcelStyled({
      selectedWeeks: weeklyTabs, allowedTrucks: trucks, getTruckElements,
      projectInfo, teams, mode: 'all', asBlob: true,
    });
    if (xlsxBlob) zip.file(`planning_complet_${base}.xlsx`, xlsxBlob);
  }

  zip.file(`base_donnees_${base}.xlsx`, buildDatabaseExcelBlob(elements, trucks, teams));
  zip.file('reimport.json', JSON.stringify(bundle, null, 2));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  saveAs(blob, `archive_${base}_${format(new Date(), 'yyyy-MM-dd')}.zip`);
}

/** Read a ZIP (or raw JSON) archive file and return its reimport bundle. */
export async function readArchiveFile(file: File): Promise<ProjectBundle> {
  let text: string;
  if (file.name.toLowerCase().endsWith('.json')) {
    text = await file.text();
  } else {
    const zip = await JSZip.loadAsync(file);
    const entry = zip.file('reimport.json') || zip.file(/reimport\.json$/)[0];
    if (!entry) throw new Error("Le fichier ZIP ne contient pas de fichier reimport.json");
    text = await entry.async('string');
  }
  const bundle = JSON.parse(text) as ProjectBundle;
  if (!bundle?.project?.id) throw new Error('Archive invalide : données du chantier manquantes');
  return bundle;
}

async function insertBatched(table: string, rows: any[]) {
  const SIZE = 500;
  for (let i = 0; i < rows.length; i += SIZE) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + SIZE));
    if (error) throw error;
  }
}

export interface ImportResult {
  projectId: string;
  token: string;
}

/** Re-create a project (and all its data) from a bundle. Returns new id + access token. */
export async function importProjectBundle(bundle: ProjectBundle, otpNumber?: string): Promise<ImportResult> {
  const newProjectId = crypto.randomUUID();
  const { id: _id, created_at: _c, updated_at: _u, ...projRest } = bundle.project;
  const { error: pErr } = await sb.from('projects').insert({
    ...projRest,
    id: newProjectId,
    otp_number: otpNumber ?? projRest.otp_number,
    archived: true,
  });
  if (pErr) throw pErr;

  const teamIdMap = new Map<string, string>();
  const teamRows = bundle.teams.map(t => {
    const nid = crypto.randomUUID();
    teamIdMap.set(t.id, nid);
    return { id: nid, project_id: newProjectId, name: t.name, sort_order: t.sort_order };
  });
  await insertBatched('teams', teamRows);

  const elemIdMap = new Map<string, string>();
  const elemRows = bundle.beam_elements.map(e => {
    const nid = crypto.randomUUID();
    elemIdMap.set(e.id, nid);
    const { id: _i, created_at: _cc, project_id: _p, ...rest } = e;
    return { ...rest, id: nid, project_id: newProjectId };
  });
  await insertBatched('beam_elements', elemRows);

  const truckRows = bundle.trucks.map(t => {
    const { id: _i, created_at: _cc, project_id: _p, team_id, element_ids, ...rest } = t;
    return {
      ...rest,
      id: crypto.randomUUID(),
      project_id: newProjectId,
      team_id: team_id ? (teamIdMap.get(team_id) || null) : null,
      element_ids: ((element_ids as string[]) || []).map(id => elemIdMap.get(id)).filter(Boolean),
    };
  });
  await insertBatched('trucks', truckRows);

  const simple = (rows: any[]) => rows.map(r => {
    const { id: _i, created_at: _c2, updated_at: _u2, project_id: _p, ...rest } = r;
    return { ...rest, project_id: newProjectId };
  });

  await insertBatched('plans', simple(bundle.plans));
  await insertBatched('forecast_weeks', simple(bundle.forecast_weeks));
  await insertBatched('forecast_slots', simple(bundle.forecast_slots));
  await insertBatched('forecast_history', simple(bundle.forecast_history));
  await insertBatched('adv_status', simple(bundle.adv_status));

  const cautionIdMap = new Map<string, string>();
  const cautionRows = bundle.adv_cautions_custom.map(c => {
    const nid = crypto.randomUUID();
    cautionIdMap.set(c.id, nid);
    const { id: _i, created_at: _c2, updated_at: _u2, project_id: _p, ...rest } = c;
    return { ...rest, id: nid, project_id: newProjectId };
  });
  await insertBatched('adv_cautions_custom', cautionRows);

  const relanceRows = bundle.adv_relances.map(r => {
    const { id: _i, created_at: _c2, updated_at: _u2, project_id: _p, source_id, ...rest } = r;
    return {
      ...rest,
      project_id: newProjectId,
      source_id: source_id ? (cautionIdMap.get(source_id) || null) : null,
    };
  });
  await insertBatched('adv_relances', relanceRows);
  await insertBatched('adv_historique', simple(bundle.adv_historique));

  const { data: link, error: lErr } = await sb.from('project_access_links')
    .insert({ project_id: newProjectId, role: 'admin', label: 'Import' })
    .select('token').single();
  if (lErr) throw lErr;

  return { projectId: newProjectId, token: link.token };
}
