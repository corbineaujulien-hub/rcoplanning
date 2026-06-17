CREATE TABLE public.forecast_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  weeks JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_email TEXT NOT NULL DEFAULT '',
  is_initial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX forecast_history_project_idx ON public.forecast_history (project_id, snapshot_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecast_history TO authenticated;
GRANT ALL ON public.forecast_history TO service_role;

ALTER TABLE public.forecast_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read forecast_history" ON public.forecast_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert forecast_history" ON public.forecast_history
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update forecast_history" ON public.forecast_history
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete forecast_history" ON public.forecast_history
  FOR DELETE TO authenticated USING (true);