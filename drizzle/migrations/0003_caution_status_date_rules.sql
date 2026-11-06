CREATE OR REPLACE FUNCTION public.adv_sync_caution_transition() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE k text; s text; old_s text; keys text[]; today date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
 IF TG_TABLE_NAME = 'adv_status' THEN keys := ARRAY['caution_rg','garantie_paiement_st']; ELSE keys := ARRAY['custom:' || NEW.id::text]; END IF;
 FOREACH k IN ARRAY keys LOOP
  IF TG_TABLE_NAME = 'adv_status' THEN s := to_jsonb(NEW)->>k; old_s := to_jsonb(OLD)->>k; ELSE s := NEW.statut; old_s := OLD.statut; END IF;
  IF s IS DISTINCT FROM old_s THEN
   IF s IN ('À demander','Non nécessaire') THEN
    INSERT INTO public.adv_caution_tracking(project_id,caution_key,date_demande,date_obtention,date_echeance,echeance_manuelle)
    VALUES(NEW.project_id,k,NULL,NULL,NULL,false)
    ON CONFLICT(project_id,caution_key) DO UPDATE SET date_demande=NULL,date_obtention=NULL,date_echeance=NULL,echeance_manuelle=false;
   ELSIF s = 'Demandée' THEN
    INSERT INTO public.adv_caution_tracking(project_id,caution_key,date_demande,date_obtention,date_echeance,echeance_manuelle)
    VALUES(NEW.project_id,k,today,NULL,NULL,false)
    ON CONFLICT(project_id,caution_key) DO UPDATE SET date_demande=coalesce(adv_caution_tracking.date_demande,today),date_obtention=NULL,date_echeance=NULL,echeance_manuelle=false;
   ELSIF s = 'Obtenue' THEN
    INSERT INTO public.adv_caution_tracking(project_id,caution_key,date_obtention)
    VALUES(NEW.project_id,k,today)
    ON CONFLICT(project_id,caution_key) DO UPDATE SET date_obtention=coalesce(adv_caution_tracking.date_obtention,today);
   END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;