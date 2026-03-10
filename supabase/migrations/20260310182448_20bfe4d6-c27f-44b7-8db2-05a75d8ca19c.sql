
-- Create teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Équipe 1',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read teams" ON public.teams FOR SELECT TO anon USING (true);
CREATE POLICY "Insert teams" ON public.teams FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Update teams" ON public.teams FOR UPDATE TO anon USING (true);
CREATE POLICY "Delete teams" ON public.teams FOR DELETE TO anon USING (true);

-- Add team_id to trucks (nullable for backward compat)
ALTER TABLE public.trucks ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Enable realtime for teams
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
