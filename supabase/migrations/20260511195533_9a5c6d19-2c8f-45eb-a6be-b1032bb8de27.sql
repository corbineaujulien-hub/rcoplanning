CREATE TABLE public.forecast_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  date_start date NOT NULL,
  date_end date NOT NULL,
  forecasted_trucks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_forecast_slots_project ON public.forecast_slots(project_id);

ALTER TABLE public.forecast_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read forecast_slots" ON public.forecast_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert forecast_slots" ON public.forecast_slots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update forecast_slots" ON public.forecast_slots FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete forecast_slots" ON public.forecast_slots FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anon read forecast_slots" ON public.forecast_slots FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert forecast_slots" ON public.forecast_slots FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update forecast_slots" ON public.forecast_slots FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon delete forecast_slots" ON public.forecast_slots FOR DELETE TO anon USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.forecast_slots;