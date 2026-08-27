CREATE INDEX IF NOT EXISTS idx_trucks_project_id ON public.trucks(project_id);
CREATE INDEX IF NOT EXISTS idx_trucks_date ON public.trucks(date);
CREATE INDEX IF NOT EXISTS idx_trucks_team_id ON public.trucks(team_id);
CREATE INDEX IF NOT EXISTS idx_beam_elements_project_id ON public.beam_elements(project_id);
CREATE INDEX IF NOT EXISTS idx_plans_project_id ON public.plans(project_id);
CREATE INDEX IF NOT EXISTS idx_teams_project_id ON public.teams(project_id);
CREATE INDEX IF NOT EXISTS idx_project_access_links_project_id ON public.project_access_links(project_id);
CREATE INDEX IF NOT EXISTS idx_forecast_weeks_year_week ON public.forecast_weeks(year, week_number);

CREATE OR REPLACE FUNCTION public.project_progress_summary()
RETURNS TABLE (
  project_id uuid,
  total_weight numeric,
  loaded_weight numeric,
  delivered_weight numeric,
  first_truck_date text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tel AS (
    SELECT t.project_id, (el.value #>> '{}') AS element_id, t.date
    FROM trucks t
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.element_ids, '[]'::jsonb)) el
  ),
  loaded AS (
    SELECT tel.project_id, tel.element_id, MIN(tel.date) AS first_date
    FROM tel
    GROUP BY tel.project_id, tel.element_id
  ),
  loaded_w AS (
    SELECT l.project_id,
           COALESCE(SUM(be.weight), 0) AS loaded_weight,
           COALESCE(SUM(CASE WHEN l.first_date <= to_char(now(), 'YYYY-MM-DD') THEN be.weight ELSE 0 END), 0) AS delivered_weight
    FROM loaded l
    JOIN beam_elements be ON be.id::text = l.element_id AND be.project_id = l.project_id
    GROUP BY l.project_id
  ),
  totals AS (
    SELECT be.project_id, COALESCE(SUM(be.weight), 0) AS total_weight
    FROM beam_elements be
    GROUP BY be.project_id
  ),
  firsts AS (
    SELECT t.project_id, MIN(t.date) AS first_truck_date
    FROM trucks t
    WHERE t.date <> ''
    GROUP BY t.project_id
  )
  SELECT p.id,
         COALESCE(tt.total_weight, 0),
         COALESCE(lw.loaded_weight, 0),
         COALESCE(lw.delivered_weight, 0),
         f.first_truck_date
  FROM projects p
  LEFT JOIN totals tt ON tt.project_id = p.id
  LEFT JOIN loaded_w lw ON lw.project_id = p.id
  LEFT JOIN firsts f ON f.project_id = p.id
$$;

REVOKE ALL ON FUNCTION public.project_progress_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.project_progress_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_progress_summary() TO service_role;