ALTER TABLE public.adv_status ADD COLUMN garantie_paiement_st text NOT NULL DEFAULT 'À demander';
UPDATE public.adv_status a SET garantie_paiement_st = CASE WHEN p.supply_only THEN 'Non nécessaire' ELSE 'À demander' END FROM public.projects p WHERE p.id = a.project_id;
CREATE TABLE public.adv_caution_tracking (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 caution_key text NOT NULL,
 date_demande date,
 date_obtention date,
 date_echeance date,
 echeance_manuelle boolean NOT NULL DEFAULT false,
 commentaire text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id, caution_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adv_caution_tracking TO authenticated;
GRANT ALL ON public.adv_caution_tracking TO service_role;
ALTER TABLE public.adv_caution_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage caution tracking" ON public.adv_caution_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX adv_caution_tracking_project_idx ON public.adv_caution_tracking(project_id);
CREATE FUNCTION public.adv_tracking_dates() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NOT NEW.echeance_manuelle THEN
  NEW.date_echeance := CASE WHEN NEW.date_obtention IS NULL THEN NULL ELSE (NEW.date_obtention + interval '1 year')::date END;
 END IF;
 NEW.updated_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER adv_tracking_dates BEFORE INSERT OR UPDATE ON public.adv_caution_tracking FOR EACH ROW EXECUTE FUNCTION public.adv_tracking_dates();
CREATE FUNCTION public.adv_sync_caution_transition() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE k text; s text; old_s text; keys text[];
BEGIN
 IF TG_TABLE_NAME = 'adv_status' THEN keys := ARRAY['caution_rg','garantie_paiement_st']; ELSE keys := ARRAY['custom:' || NEW.id::text]; END IF;
 FOREACH k IN ARRAY keys LOOP
  IF TG_TABLE_NAME = 'adv_status' THEN s := to_jsonb(NEW)->>k; old_s := to_jsonb(OLD)->>k; ELSE s := NEW.statut; old_s := OLD.statut; END IF;
  IF s IS DISTINCT FROM old_s AND s IN ('Demandée','Obtenue') THEN
   INSERT INTO public.adv_caution_tracking(project_id,caution_key,date_demande,date_obtention)
   VALUES(NEW.project_id,k,CASE WHEN s = 'Demandée' THEN (now() AT TIME ZONE 'Europe/Paris')::date END,CASE WHEN s = 'Obtenue' THEN (now() AT TIME ZONE 'Europe/Paris')::date END)
   ON CONFLICT(project_id,caution_key) DO UPDATE SET
    date_demande = coalesce(adv_caution_tracking.date_demande,EXCLUDED.date_demande),
    date_obtention = coalesce(adv_caution_tracking.date_obtention,EXCLUDED.date_obtention);
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER adv_status_caution_transition AFTER UPDATE ON public.adv_status FOR EACH ROW EXECUTE FUNCTION public.adv_sync_caution_transition();
CREATE TRIGGER adv_custom_caution_transition AFTER UPDATE ON public.adv_cautions_custom FOR EACH ROW EXECUTE FUNCTION public.adv_sync_caution_transition();