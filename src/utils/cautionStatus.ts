import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { AdvDemarcheKey, findRelanceRules } from '@/utils/adv';

const sb = supabase as any;

export interface CautionStatusChange {
  projectId: string;
  /** 'caution_rg' | 'garantie_paiement_st' | 'custom:<uuid>' */
  cautionKey: string;
  /** Libellé d'historique exact : 'Caution RG', 'Garantie de paiement sous-traitant', 'Caution "nom"' */
  label: string;
  oldStatus: string;
  newStatus: string;
  userEmail: string;
  startDate?: Date | null;
}

/**
 * Point d'entrée unique pour tout changement de statut d'une caution
 * (onglet ADV du chantier et focus « Suivi des cautions »).
 * Les dates de suivi sont gérées par le trigger adv_sync_caution_transition ;
 * cette fonction met à jour le statut, l'historique et les relances.
 */
export async function updateCautionStatus(change: CautionStatusChange): Promise<{ error?: unknown }> {
  const { projectId, cautionKey, label, oldStatus, newStatus, userEmail, startDate = null } = change;
  if (oldStatus === newStatus) return {};
  const isCustom = cautionKey.startsWith('custom:');
  const demarche: AdvDemarcheKey | 'caution_custom' = isCustom ? 'caution_custom' : (cautionKey as AdvDemarcheKey);
  const sourceId = isCustom ? cautionKey.slice(7) : null;

  const { error } = isCustom
    ? await sb.from('adv_cautions_custom').update({ statut: newStatus }).eq('id', sourceId)
    : await sb.from('adv_status').update({ [cautionKey]: newStatus }).eq('project_id', projectId);
  if (error) return { error };

  await sb.from('adv_historique').insert({
    project_id: projectId,
    description: `${label} : ${oldStatus} → ${newStatus}`,
    user_email: userEmail,
  });

  // Relances : clôturer les ouvertes de cette démarche, puis créer les nouvelles
  const filter = sb.from('adv_relances').update({ statut: 'Traitée' })
    .eq('project_id', projectId)
    .eq('demarche', demarche)
    .neq('statut', 'Traitée');
  if (sourceId) await filter.eq('source_id', sourceId);
  else await filter.is('source_id', null);

  const now = new Date();
  for (const rule of findRelanceRules(demarche, newStatus)) {
    const ech = rule.computeEcheance(now, startDate);
    if (!ech) continue;
    await sb.from('adv_relances').insert({
      project_id: projectId,
      demarche,
      source_id: sourceId,
      type: `${label} — ${rule.label}`,
      echeance: format(ech, 'yyyy-MM-dd'),
      statut: 'En attente',
    });
  }
  return {};
}
