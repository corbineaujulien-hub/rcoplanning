
-- Drop all anon policies on data tables
DROP POLICY IF EXISTS "Read projects" ON public.projects;
DROP POLICY IF EXISTS "Update projects" ON public.projects;

DROP POLICY IF EXISTS "Read plans" ON public.plans;
DROP POLICY IF EXISTS "Insert plans" ON public.plans;
DROP POLICY IF EXISTS "Update plans" ON public.plans;
DROP POLICY IF EXISTS "Delete plans" ON public.plans;

DROP POLICY IF EXISTS "Read elements" ON public.beam_elements;
DROP POLICY IF EXISTS "Insert elements" ON public.beam_elements;
DROP POLICY IF EXISTS "Update elements" ON public.beam_elements;
DROP POLICY IF EXISTS "Delete elements" ON public.beam_elements;

DROP POLICY IF EXISTS "Read trucks" ON public.trucks;
DROP POLICY IF EXISTS "Insert trucks" ON public.trucks;
DROP POLICY IF EXISTS "Update trucks" ON public.trucks;
DROP POLICY IF EXISTS "Delete trucks" ON public.trucks;

DROP POLICY IF EXISTS "Read teams" ON public.teams;
DROP POLICY IF EXISTS "Insert teams" ON public.teams;
DROP POLICY IF EXISTS "Update teams" ON public.teams;
DROP POLICY IF EXISTS "Delete teams" ON public.teams;

DROP POLICY IF EXISTS "Anon read forecast_slots" ON public.forecast_slots;
DROP POLICY IF EXISTS "Anon insert forecast_slots" ON public.forecast_slots;
DROP POLICY IF EXISTS "Anon update forecast_slots" ON public.forecast_slots;
DROP POLICY IF EXISTS "Anon delete forecast_slots" ON public.forecast_slots;

DROP POLICY IF EXISTS "Anon read forecast_weeks" ON public.forecast_weeks;
DROP POLICY IF EXISTS "Anon insert forecast_weeks" ON public.forecast_weeks;
DROP POLICY IF EXISTS "Anon update forecast_weeks" ON public.forecast_weeks;
DROP POLICY IF EXISTS "Anon delete forecast_weeks" ON public.forecast_weeks;

DROP POLICY IF EXISTS "Anyone can validate tokens" ON public.project_access_links;

-- Revoke anon grants on data tables
REVOKE ALL ON public.projects FROM anon;
REVOKE ALL ON public.plans FROM anon;
REVOKE ALL ON public.beam_elements FROM anon;
REVOKE ALL ON public.trucks FROM anon;
REVOKE ALL ON public.teams FROM anon;
REVOKE ALL ON public.forecast_slots FROM anon;
REVOKE ALL ON public.forecast_weeks FROM anon;
REVOKE ALL ON public.project_access_links FROM anon;

-- Lock SECURITY DEFINER functions: only authenticated users can call them
REVOKE EXECUTE ON FUNCTION public.validate_token(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_project() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_project(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_project_by_id(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.validate_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_project() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_project(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_project_by_id(uuid) TO authenticated;
