import { addDays, subMonths, parseISO, format } from 'date-fns';

export type AdvDemarcheKey =
  | 'compte_client'
  | 'garantie_sfac'
  | 'contrat_client'
  | 'caution_rg'
  | 'contrat_st'
  | 'dast';

export interface AdvStatus {
  id: string;
  project_id: string;
  compte_client: string;
  garantie_sfac: string;
  contrat_client: string;
  caution_rg: string;
  contrat_st: string;
  dast: string;
  commentaire: string;
}

export interface AdvCautionCustom {
  id: string;
  project_id: string;
  nom: string;
  statut: string;
}

export interface AdvRelance {
  id: string;
  project_id: string;
  demarche: string;
  source_id: string | null;
  type: string;
  echeance: string; // YYYY-MM-DD
  statut: 'En attente' | 'Échue' | 'Traitée';
}

export interface AdvHistorique {
  id: string;
  project_id: string;
  date: string;
  description: string;
  user_email: string;
}

export const DEMARCHE_LABELS: Record<AdvDemarcheKey, string> = {
  compte_client: 'Compte client',
  garantie_sfac: 'Garantie SFAC',
  contrat_client: 'Contrat client',
  caution_rg: 'Caution RG',
  contrat_st: 'Contrat sous-traitant',
  dast: 'DAST',
};

export const DEMARCHE_OPTIONS: Record<AdvDemarcheKey, string[]> = {
  compte_client: ['À ouvrir', 'Demande effectuée', 'Ouvert'],
  garantie_sfac: ['À demander', 'Demandée', 'Accord obtenu', 'Refusée'],
  contrat_client: ['Non reçu', 'Envoyé', 'Signé'],
  caution_rg: ['Non nécessaire', 'À demander', 'Demandée', 'Obtenue'],
  contrat_st: ['Non nécessaire', 'En attente devis poseur', 'Contrat envoyé', 'Contrat signé'],
  dast: ['Non nécessaire', 'À préparer', 'Envoyée', 'Acceptée', 'Refusée'],
};

export const CAUTION_STATUSES = DEMARCHE_OPTIONS.caution_rg;

export const FINAL_STATUSES = new Set([
  'Ouvert', 'Accord obtenu', 'Signé', 'Obtenue', 'Contrat signé', 'Acceptée',
]);
export const INTERMEDIATE_STATUSES = new Set([
  'Demande effectuée', 'Demandée', 'Envoyé', 'Contrat envoyé', 'À préparer', 'Envoyée',
]);
export const INITIAL_STATUSES = new Set([
  'À ouvrir', 'À demander', 'Non reçu', 'Refusée',
]);

export type StatusColor = 'green' | 'orange' | 'red' | 'gray';

export function getStatusColor(status: string): StatusColor {
  if (status === 'Non nécessaire') return 'gray';
  if (FINAL_STATUSES.has(status)) return 'green';
  if (INTERMEDIATE_STATUSES.has(status)) return 'orange';
  return 'red';
}

export function getStatusDotClass(status: string): string {
  const c = getStatusColor(status);
  if (c === 'green') return 'bg-green-500';
  if (c === 'orange') return 'bg-orange-500';
  if (c === 'red') return 'bg-red-500';
  return 'bg-gray-400';
}

export function getDefaultAdv(supplyOnly: boolean): Omit<AdvStatus, 'id' | 'project_id'> {
  return {
    compte_client: 'À ouvrir',
    garantie_sfac: 'À demander',
    contrat_client: 'Non reçu',
    caution_rg: 'À demander',
    contrat_st: supplyOnly ? 'Non nécessaire' : 'En attente devis poseur',
    dast: supplyOnly ? 'Non nécessaire' : 'À préparer',
    commentaire: '',
  };
}

export function calculateAdvScore(
  adv: Pick<AdvStatus, AdvDemarcheKey> | null | undefined,
  customCautions: Pick<AdvCautionCustom, 'statut'>[] = []
): number {
  if (!adv) return 0;
  const all = [
    adv.compte_client, adv.garantie_sfac, adv.contrat_client,
    adv.caution_rg, adv.contrat_st, adv.dast,
    ...customCautions.map(c => c.statut),
  ];
  const applicable = all.filter(d => d && d !== 'Non nécessaire');
  if (applicable.length === 0) return 100;
  const completed = applicable.filter(d => FINAL_STATUSES.has(d)).length;
  return Math.round((completed / applicable.length) * 100);
}

export function getScoreHexColor(score: number): string {
  if (score >= 99) return '#16a34a';
  if (score >= 51) return '#f97316';
  return '#dc2626';
}

export function getScoreColorClass(score: number): string {
  if (score >= 99) return 'text-green-600';
  if (score >= 51) return 'text-orange-500';
  return 'text-red-600';
}

export interface RelanceRule {
  demarche: AdvDemarcheKey | 'caution_custom';
  status: string;
  label: string;
  computeEcheance: (changeDate: Date, startDate: Date | null) => Date | null;
}

export const RELANCE_RULES: RelanceRule[] = [
  {
    demarche: 'contrat_client', status: 'Non reçu',
    label: "Relance chargé d'affaires",
    computeEcheance: (_change, start) => start ? subMonths(start, 2) : null,
  },
  {
    demarche: 'contrat_client', status: 'Envoyé',
    label: 'Relance contrat client',
    computeEcheance: (change) => addDays(change, 15),
  },
  {
    demarche: 'garantie_sfac', status: 'Demandée',
    label: 'Relance garantie SFAC',
    computeEcheance: (change) => addDays(change, 7),
  },
  {
    demarche: 'caution_rg', status: 'Demandée',
    label: 'Relance caution',
    computeEcheance: (change) => addDays(change, 7),
  },
  {
    demarche: 'caution_custom', status: 'Demandée',
    label: 'Relance caution',
    computeEcheance: (change) => addDays(change, 7),
  },
  {
    demarche: 'contrat_st', status: 'En attente devis poseur',
    label: 'Relance conducteur de travaux',
    computeEcheance: (_change, start) => start ? subMonths(start, 1) : null,
  },
  {
    demarche: 'contrat_st', status: 'Contrat envoyé',
    label: 'Relance contrat sous-traitant',
    computeEcheance: (change) => addDays(change, 7),
  },
];

export function findRelanceRules(
  demarche: AdvDemarcheKey | 'caution_custom',
  status: string
): RelanceRule[] {
  return RELANCE_RULES.filter(r => r.demarche === demarche && r.status === status);
}

export function formatDateFR(iso: string): string {
  if (!iso) return '';
  try {
    const d = iso.includes('T') ? new Date(iso) : parseISO(iso);
    return format(d, 'dd/MM/yyyy');
  } catch { return iso; }
}

export function formatDateTimeFR(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return format(d, 'dd/MM/yyyy HH:mm');
  } catch { return iso; }
}

export function isRelanceEchue(echeance: string, today = new Date()): boolean {
  return echeance <= format(today, 'yyyy-MM-dd');
}

export function effectiveRelanceStatus(r: Pick<AdvRelance, 'statut' | 'echeance'>): 'En attente' | 'Échue' | 'Traitée' {
  if (r.statut === 'Traitée') return 'Traitée';
  return isRelanceEchue(r.echeance) ? 'Échue' : 'En attente';
}

export function getApplicableDemarches(adv: Pick<AdvStatus, AdvDemarcheKey>): { key: AdvDemarcheKey; status: string }[] {
  const out: { key: AdvDemarcheKey; status: string }[] = [];
  (Object.keys(DEMARCHE_LABELS) as AdvDemarcheKey[]).forEach(k => {
    const s = adv[k];
    if (s && s !== 'Non nécessaire') out.push({ key: k, status: s });
  });
  return out;
}

export function isDemarcheFinal(status: string): boolean {
  return FINAL_STATUSES.has(status);
}