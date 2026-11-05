-- Run through the managed data-change tool. Safe to rerun; history timestamps use Europe/Paris.
WITH catalog AS (
 SELECT project_id, 'caution_rg'::text AS caution_key, caution_rg AS statut, ARRAY['Caution RG']::text[] AS labels FROM public.adv_status
 UNION ALL
 SELECT project_id, 'garantie_paiement_st', garantie_paiement_st, ARRAY['Garantie de paiement sous-traitant','Garantie de paiement ST'] FROM public.adv_status
 UNION ALL
 SELECT project_id, 'custom:' || id::text, statut,
  CASE WHEN count(*) OVER (PARTITION BY project_id, nom) = 1 AND nom <> '' THEN ARRAY['Caution "' || nom || '"'] ELSE ARRAY[]::text[] END
 FROM public.adv_cautions_custom
), targets AS (
 SELECT c.project_id,c.caution_key,c.labels FROM catalog c
 WHERE c.statut IN ('Demandée','Obtenue')
 UNION
 SELECT t.project_id,t.caution_key,coalesce(c.labels,ARRAY[]::text[]) FROM public.adv_caution_tracking t
 LEFT JOIN catalog c USING(project_id,caution_key)
), history AS (
 SELECT t.project_id,t.caution_key,
  max((h.date AT TIME ZONE 'Europe/Paris')::date) FILTER (WHERE h.description LIKE '% → Demandée') AS demande,
  max((h.date AT TIME ZONE 'Europe/Paris')::date) FILTER (WHERE h.description LIKE '% → Obtenue') AS obtention
 FROM targets t LEFT JOIN public.adv_historique h ON h.project_id=t.project_id
 AND EXISTS (SELECT 1 FROM unnest(t.labels) label
  WHERE left(h.description,length(label || ' : '))=label || ' : '
  AND substring(h.description FROM length(label || ' : ')+1) ~ '^.+ → (Demandée|Obtenue)$')
 GROUP BY t.project_id,t.caution_key
), candidates AS (
 SELECT h.*,t.id AS existing_id,t.date_demande AS old_demande,t.date_obtention AS old_obtention,t.date_echeance AS old_echeance,
  coalesce(t.date_demande,h.demande) AS date_demande,
  coalesce(t.date_obtention,h.obtention) AS date_obtention,
  coalesce(t.date_echeance,CASE WHEN NOT coalesce(t.echeance_manuelle,false) THEN (coalesce(t.date_obtention,h.obtention)+interval '1 year')::date END) AS date_echeance,
  coalesce(t.echeance_manuelle,false) AS echeance_manuelle
 FROM history h LEFT JOIN public.adv_caution_tracking t USING(project_id,caution_key)
), written AS (
 INSERT INTO public.adv_caution_tracking AS current(project_id,caution_key,date_demande,date_obtention,date_echeance,echeance_manuelle)
 SELECT project_id,caution_key,date_demande,date_obtention,date_echeance,echeance_manuelle FROM candidates
 WHERE existing_id IS NULL OR old_demande IS DISTINCT FROM date_demande
 OR old_obtention IS DISTINCT FROM date_obtention OR old_echeance IS DISTINCT FROM date_echeance
 ON CONFLICT(project_id,caution_key) DO UPDATE SET
 date_demande=coalesce(current.date_demande,EXCLUDED.date_demande),
 date_obtention=coalesce(current.date_obtention,EXCLUDED.date_obtention),
 date_echeance=coalesce(current.date_echeance,CASE WHEN NOT current.echeance_manuelle THEN EXCLUDED.date_echeance END)
 WHERE (current.date_demande IS NULL AND EXCLUDED.date_demande IS NOT NULL)
 OR (current.date_obtention IS NULL AND EXCLUDED.date_obtention IS NOT NULL)
 OR (current.date_echeance IS NULL AND NOT current.echeance_manuelle AND EXCLUDED.date_echeance IS NOT NULL)
 RETURNING project_id,caution_key,date_demande,date_obtention,date_echeance
)
SELECT (SELECT count(*) FROM candidates) AS cautions_traitees,
 count(*) FILTER (WHERE c.old_demande IS NULL AND w.date_demande IS NOT NULL) AS demandes_reconstituees,
 count(*) FILTER (WHERE c.old_obtention IS NULL AND w.date_obtention IS NOT NULL) AS obtentions_reconstituees,
 count(*) FILTER (WHERE c.old_echeance IS NULL AND w.date_echeance IS NOT NULL) AS echeances_calculees,
 (SELECT count(*) FROM candidates WHERE demande IS NULL AND obtention IS NULL AND date_demande IS NULL AND date_obtention IS NULL) AS sans_historique_dates_vides,
 count(*) AS lignes_modifiees
FROM written w JOIN candidates c USING(project_id,caution_key);