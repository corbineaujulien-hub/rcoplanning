
-- Module ADV : 4 nouvelles tables liées à un chantier

-- adv_status : une fiche par projet
CREATE TABLE public.adv_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  compte_client text NOT NULL DEFAULT 'À ouvrir',
  garantie_sfac text NOT NULL DEFAULT 'À demander',
  contrat_client text NOT NULL DEFAULT 'Non reçu',
  caution_rg text NOT NULL DEFAULT 'À demander',
  contrat_st text NOT NULL DEFAULT 'En attente devis poseur',
  dast text NOT NULL DEFAULT 'À préparer',
  commentaire text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adv_status TO authenticated;
GRANT ALL ON public.adv_status TO service_role;
ALTER TABLE public.adv_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read adv_status" ON public.adv_status FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert adv_status" ON public.adv_status FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update adv_status" ON public.adv_status FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete adv_status" ON public.adv_status FOR DELETE TO authenticated USING (true);

-- adv_cautions_custom : cautions supplémentaires par projet
CREATE TABLE public.adv_cautions_custom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  nom text NOT NULL DEFAULT '',
  statut text NOT NULL DEFAULT 'À demander',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX adv_cautions_custom_project_idx ON public.adv_cautions_custom(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adv_cautions_custom TO authenticated;
GRANT ALL ON public.adv_cautions_custom TO service_role;
ALTER TABLE public.adv_cautions_custom ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read adv_cautions" ON public.adv_cautions_custom FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert adv_cautions" ON public.adv_cautions_custom FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update adv_cautions" ON public.adv_cautions_custom FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete adv_cautions" ON public.adv_cautions_custom FOR DELETE TO authenticated USING (true);

-- adv_relances : relances automatiques par démarche
CREATE TABLE public.adv_relances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  demarche text NOT NULL,
  source_id uuid,
  type text NOT NULL,
  echeance date NOT NULL,
  statut text NOT NULL DEFAULT 'En attente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX adv_relances_project_idx ON public.adv_relances(project_id);
CREATE INDEX adv_relances_echeance_idx ON public.adv_relances(echeance);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adv_relances TO authenticated;
GRANT ALL ON public.adv_relances TO service_role;
ALTER TABLE public.adv_relances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read adv_relances" ON public.adv_relances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert adv_relances" ON public.adv_relances FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update adv_relances" ON public.adv_relances FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete adv_relances" ON public.adv_relances FOR DELETE TO authenticated USING (true);

-- adv_historique : journal des modifications
CREATE TABLE public.adv_historique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL,
  user_email text NOT NULL DEFAULT ''
);
CREATE INDEX adv_historique_project_idx ON public.adv_historique(project_id, date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adv_historique TO authenticated;
GRANT ALL ON public.adv_historique TO service_role;
ALTER TABLE public.adv_historique ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read adv_historique" ON public.adv_historique FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert adv_historique" ON public.adv_historique FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update adv_historique" ON public.adv_historique FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete adv_historique" ON public.adv_historique FOR DELETE TO authenticated USING (true);

-- Trigger generique updated_at
CREATE OR REPLACE FUNCTION public.adv_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER adv_status_updated_at BEFORE UPDATE ON public.adv_status FOR EACH ROW EXECUTE FUNCTION public.adv_set_updated_at();
CREATE TRIGGER adv_cautions_updated_at BEFORE UPDATE ON public.adv_cautions_custom FOR EACH ROW EXECUTE FUNCTION public.adv_set_updated_at();
CREATE TRIGGER adv_relances_updated_at BEFORE UPDATE ON public.adv_relances FOR EACH ROW EXECUTE FUNCTION public.adv_set_updated_at();
