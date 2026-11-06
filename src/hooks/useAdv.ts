import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
  AdvStatus, AdvCautionCustom, AdvRelance, AdvHistorique,
  AdvDemarcheKey, getDefaultAdv, findRelanceRules, DEMARCHE_LABELS,
} from '@/utils/adv';
import { format } from 'date-fns';
import { fetchPaginated } from '@/utils/cautionTracking';
import { updateCautionStatus } from '@/utils/cautionStatus';
import { toast } from 'sonner';

const sb = supabase as any;

export function useAdv(projectId: string, supplyOnly: boolean, startDate: Date | null) {
  const { user } = useAuth();
  const [adv, setAdv] = useState<AdvStatus | null>(null);
  const [cautions, setCautions] = useState<AdvCautionCustom[]>([]);
  const [relances, setRelances] = useState<AdvRelance[]>([]);
  const [historique, setHistorique] = useState<AdvHistorique[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: existing } = await sb.from('adv_status').select('*').eq('project_id', projectId).maybeSingle();
      let row = existing;
      if (!row) {
        const defaults = getDefaultAdv(supplyOnly);
        const { data: inserted } = await sb.from('adv_status').insert({ project_id: projectId, ...defaults }).select('*').single();
        row = inserted;
      }
      const [c, r, h] = await Promise.all([
        fetchPaginated(() => sb.from('adv_cautions_custom').select('id, project_id, nom, statut').eq('project_id', projectId).order('created_at').order('id')),
        fetchPaginated(() => sb.from('adv_relances').select('id, project_id, demarche, source_id, type, echeance, statut').eq('project_id', projectId).order('echeance').order('id')),
        fetchPaginated(() => sb.from('adv_historique').select('id, project_id, date, description, user_email').eq('project_id', projectId).order('date', { ascending: false }).order('id')),
      ]);
      if (cancelled) return;
      setAdv(row as AdvStatus);
      setCautions((c || []) as AdvCautionCustom[]);
      setRelances((r || []) as AdvRelance[]);
      setHistorique((h || []) as AdvHistorique[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId, supplyOnly]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`adv-${projectId}`)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'adv_status', filter: `project_id=eq.${projectId}` }, (p: any) => {
        if (p.eventType === 'DELETE') setAdv(null);
        else setAdv(p.new as AdvStatus);
      })
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'adv_cautions_custom', filter: `project_id=eq.${projectId}` }, (p: any) => {
        if (p.eventType === 'INSERT') setCautions(prev => prev.some(x => x.id === p.new.id) ? prev : [...prev, p.new]);
        else if (p.eventType === 'UPDATE') setCautions(prev => prev.map(x => x.id === p.new.id ? p.new : x));
        else if (p.eventType === 'DELETE') setCautions(prev => prev.filter(x => x.id !== p.old.id));
      })
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'adv_relances', filter: `project_id=eq.${projectId}` }, (p: any) => {
        if (p.eventType === 'INSERT') setRelances(prev => prev.some(x => x.id === p.new.id) ? prev : [...prev, p.new]);
        else if (p.eventType === 'UPDATE') setRelances(prev => prev.map(x => x.id === p.new.id ? p.new : x));
        else if (p.eventType === 'DELETE') setRelances(prev => prev.filter(x => x.id !== p.old.id));
      })
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'adv_historique', filter: `project_id=eq.${projectId}` }, (p: any) => {
        if (p.eventType === 'INSERT') setHistorique(prev => prev.some(x => x.id === p.new.id) ? prev : [p.new, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId]);

  const logHistory = useCallback(async (description: string) => {
    await sb.from('adv_historique').insert({
      project_id: projectId,
      description,
      user_email: user?.email || '',
    });
  }, [projectId, user?.email]);

  const processRelances = useCallback(async (
    demarche: AdvDemarcheKey | 'caution_custom',
    newStatus: string,
    sourceId: string | null,
    label: string
  ) => {
    // Mark all open relances for this démarche+source as Traitée
    const filter = sb.from('adv_relances').update({ statut: 'Traitée' })
      .eq('project_id', projectId)
      .eq('demarche', demarche)
      .neq('statut', 'Traitée');
    if (sourceId) await filter.eq('source_id', sourceId);
    else await filter.is('source_id', null);

    // Create new ones
    const rules = findRelanceRules(demarche, newStatus);
    const now = new Date();
    for (const rule of rules) {
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
  }, [projectId, startDate]);

  const updateDemarche = useCallback(async (key: AdvDemarcheKey, value: string) => {
    if (!adv) return;
    const old = adv[key];
    if (old === value) return;
    setAdv({ ...adv, [key]: value });
    if (key === 'caution_rg' || key === 'garantie_paiement_st') {
      const { error } = await updateCautionStatus({
        projectId, cautionKey: key, label: DEMARCHE_LABELS[key], oldStatus: old, newStatus: value,
        userEmail: user?.email || '', startDate,
      });
      if (error) { setAdv(adv); toast.error('Le statut n’a pas été enregistré'); }
      return;
    }
    const { error } = await sb.from('adv_status').update({ [key]: value }).eq('project_id', projectId);
    if (error) { setAdv(adv); toast.error('Le statut n’a pas été enregistré'); return; }
    await logHistory(`${DEMARCHE_LABELS[key]} : ${old} → ${value}`);
    await processRelances(key, value, null, DEMARCHE_LABELS[key]);
  }, [adv, projectId, logHistory, processRelances, user?.email, startDate]);

  const updateCommentaire = useCallback(async (value: string) => {
    if (!adv) return;
    if (adv.commentaire === value) return;
    setAdv({ ...adv, commentaire: value });
    await sb.from('adv_status').update({ commentaire: value }).eq('project_id', projectId);
  }, [adv, projectId]);

  const addCaution = useCallback(async () => {
    const { data } = await sb.from('adv_cautions_custom').insert({
      project_id: projectId, nom: 'Nouvelle caution', statut: 'À demander',
    }).select('*').single();
    if (data) {
      setCautions(prev => prev.some(x => x.id === data.id) ? prev : [...prev, data]);
      await logHistory(`Caution ajoutée : ${data.nom}`);
    }
  }, [projectId, logHistory]);

  const updateCaution = useCallback(async (id: string, updates: Partial<AdvCautionCustom>) => {
    const c = cautions.find(x => x.id === id);
    if (!c) return;
    setCautions(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x));
    if (updates.statut && updates.statut !== c.statut) {
      const { error } = await updateCautionStatus({
        projectId, cautionKey: `custom:${id}`, label: `Caution "${c.nom}"`,
        oldStatus: c.statut, newStatus: updates.statut, userEmail: user?.email || '', startDate,
      });
      if (error) { setCautions(prev => prev.map(x => x.id === id ? c : x)); toast.error('La caution n’a pas été enregistrée'); return; }
      const rest = { ...updates }; delete rest.statut;
      if (Object.keys(rest).length) await sb.from('adv_cautions_custom').update(rest).eq('id', id);
      return;
    }
    const { error } = await sb.from('adv_cautions_custom').update(updates).eq('id', id);
    if (error) { setCautions(prev => prev.map(x => x.id === id ? c : x)); toast.error('La caution n’a pas été enregistrée'); }
  }, [cautions, projectId, user?.email, startDate]);

  const deleteCaution = useCallback(async (id: string) => {
    const c = cautions.find(x => x.id === id);
    setCautions(prev => prev.filter(x => x.id !== id));
    await sb.from('adv_cautions_custom').delete().eq('id', id);
    await sb.from('adv_relances').delete().eq('source_id', id);
    await sb.from('adv_caution_tracking').delete().eq('project_id', projectId).eq('caution_key', `custom:${id}`);
    if (c) await logHistory(`Caution supprimée : ${c.nom}`);
  }, [cautions, logHistory]);

  return {
    adv, cautions, relances, historique, loading,
    updateDemarche, updateCommentaire, addCaution, updateCaution, deleteCaution,
  };
}