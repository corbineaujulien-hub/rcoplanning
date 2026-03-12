
-- Add authenticated policies for beam_elements
CREATE POLICY "Authenticated read beam_elements" ON public.beam_elements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert beam_elements" ON public.beam_elements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update beam_elements" ON public.beam_elements FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete beam_elements" ON public.beam_elements FOR DELETE TO authenticated USING (true);

-- Add authenticated policies for plans
CREATE POLICY "Authenticated read plans" ON public.plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert plans" ON public.plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update plans" ON public.plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete plans" ON public.plans FOR DELETE TO authenticated USING (true);

-- Add authenticated policies for project_access_links
CREATE POLICY "Authenticated read project_access_links" ON public.project_access_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert project_access_links" ON public.project_access_links FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update project_access_links" ON public.project_access_links FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete project_access_links" ON public.project_access_links FOR DELETE TO authenticated USING (true);

-- Add authenticated policies for projects
CREATE POLICY "Authenticated read projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update projects" ON public.projects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete projects" ON public.projects FOR DELETE TO authenticated USING (true);

-- Add authenticated policies for teams
CREATE POLICY "Authenticated read teams" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update teams" ON public.teams FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete teams" ON public.teams FOR DELETE TO authenticated USING (true);

-- Add authenticated policies for trucks
CREATE POLICY "Authenticated read trucks" ON public.trucks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert trucks" ON public.trucks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update trucks" ON public.trucks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete trucks" ON public.trucks FOR DELETE TO authenticated USING (true);
