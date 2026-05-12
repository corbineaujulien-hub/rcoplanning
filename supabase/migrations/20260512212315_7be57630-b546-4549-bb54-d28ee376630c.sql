ALTER TABLE public.forecast_weeks
  ADD COLUMN IF NOT EXISTS team_index INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS forecast_team_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS forecast_period_start DATE,
  ADD COLUMN IF NOT EXISTS forecast_period_end DATE;

CREATE INDEX IF NOT EXISTS forecast_weeks_project_idx ON public.forecast_weeks(project_id);