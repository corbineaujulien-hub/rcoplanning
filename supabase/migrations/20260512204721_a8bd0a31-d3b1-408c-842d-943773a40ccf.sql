-- Create forecast_weeks table to store selected forecast weeks per project
CREATE TABLE IF NOT EXISTS public.forecast_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  year integer NOT NULL,
  week_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, year, week_number)
);

CREATE INDEX IF NOT EXISTS idx_forecast_weeks_project ON public.forecast_weeks(project_id);

ALTER TABLE public.forecast_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read forecast_weeks" ON public.forecast_weeks FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert forecast_weeks" ON public.forecast_weeks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update forecast_weeks" ON public.forecast_weeks FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon delete forecast_weeks" ON public.forecast_weeks FOR DELETE TO anon USING (true);
CREATE POLICY "Authenticated read forecast_weeks" ON public.forecast_weeks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert forecast_weeks" ON public.forecast_weeks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update forecast_weeks" ON public.forecast_weeks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete forecast_weeks" ON public.forecast_weeks FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.forecast_weeks;
ALTER TABLE public.forecast_weeks REPLICA IDENTITY FULL;

-- Add forecasted_transports jsonb column to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS forecasted_transports jsonb NOT NULL DEFAULT '[]'::jsonb;
