
-- Create role enum
CREATE TYPE public.access_role AS ENUM ('admin', 'editor', 'viewer');

-- Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  otp_number text DEFAULT '',
  site_name text DEFAULT '',
  client_name text DEFAULT '',
  site_address text DEFAULT '',
  conductor text DEFAULT '',
  subcontractor text DEFAULT '',
  contact_name text DEFAULT '',
  contact_phone text DEFAULT '',
  show_saturdays boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Beam elements
CREATE TABLE public.beam_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  repere text NOT NULL DEFAULT '',
  zone text DEFAULT '',
  product_type text DEFAULT '',
  section text DEFAULT '',
  length numeric DEFAULT 0,
  weight numeric DEFAULT 0,
  factory text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Trucks
CREATE TABLE public.trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  number text NOT NULL DEFAULT '',
  date text NOT NULL DEFAULT '',
  time text NOT NULL DEFAULT '',
  element_ids jsonb DEFAULT '[]'::jsonb,
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Plans
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT '',
  zones jsonb DEFAULT '[]'::jsonb,
  product_types jsonb DEFAULT '[]'::jsonb,
  detected_reperes jsonb DEFAULT '[]'::jsonb,
  pdf_data_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Access links
CREATE TABLE public.project_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  role access_role NOT NULL DEFAULT 'viewer',
  label text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beam_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_access_links ENABLE ROW LEVEL SECURITY;

-- RLS: Allow anon to read access links (token validation)
CREATE POLICY "Anyone can validate tokens" ON public.project_access_links
  FOR SELECT TO anon USING (true);

-- RLS: projects - read/update filtered by project_id
CREATE POLICY "Read projects" ON public.projects FOR SELECT TO anon USING (true);
CREATE POLICY "Update projects" ON public.projects FOR UPDATE TO anon USING (true);

-- RLS: beam_elements
CREATE POLICY "Read elements" ON public.beam_elements FOR SELECT TO anon USING (true);
CREATE POLICY "Insert elements" ON public.beam_elements FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Update elements" ON public.beam_elements FOR UPDATE TO anon USING (true);
CREATE POLICY "Delete elements" ON public.beam_elements FOR DELETE TO anon USING (true);

-- RLS: trucks
CREATE POLICY "Read trucks" ON public.trucks FOR SELECT TO anon USING (true);
CREATE POLICY "Insert trucks" ON public.trucks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Update trucks" ON public.trucks FOR UPDATE TO anon USING (true);
CREATE POLICY "Delete trucks" ON public.trucks FOR DELETE TO anon USING (true);

-- RLS: plans
CREATE POLICY "Read plans" ON public.plans FOR SELECT TO anon USING (true);
CREATE POLICY "Insert plans" ON public.plans FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Update plans" ON public.plans FOR UPDATE TO anon USING (true);
CREATE POLICY "Delete plans" ON public.plans FOR DELETE TO anon USING (true);

-- RPC: Create a new project with 3 access links
CREATE OR REPLACE FUNCTION public.create_project()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_project_id uuid;
  admin_token text;
  editor_token text;
  viewer_token text;
BEGIN
  INSERT INTO projects DEFAULT VALUES RETURNING id INTO new_project_id;
  
  INSERT INTO project_access_links (project_id, role, label)
  VALUES (new_project_id, 'admin', 'Lien administrateur')
  RETURNING token INTO admin_token;
  
  INSERT INTO project_access_links (project_id, role, label)
  VALUES (new_project_id, 'editor', 'Lien éditeur')
  RETURNING token INTO editor_token;
  
  INSERT INTO project_access_links (project_id, role, label)
  VALUES (new_project_id, 'viewer', 'Lien lecteur')
  RETURNING token INTO viewer_token;
  
  RETURN jsonb_build_object(
    'project_id', new_project_id,
    'admin_token', admin_token,
    'editor_token', editor_token,
    'viewer_token', viewer_token
  );
END;
$$;

-- RPC: Validate a token
CREATE OR REPLACE FUNCTION public.validate_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_record record;
BEGIN
  SELECT pal.project_id, pal.role, p.site_name
  INTO link_record
  FROM project_access_links pal
  JOIN projects p ON p.id = pal.project_id
  WHERE pal.token = p_token;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  RETURN jsonb_build_object(
    'project_id', link_record.project_id,
    'role', link_record.role,
    'site_name', link_record.site_name
  );
END;
$$;

-- RPC: Delete a project (admin only)
CREATE OR REPLACE FUNCTION public.delete_project(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_role access_role;
BEGIN
  SELECT pal.project_id, pal.role INTO v_project_id, v_role
  FROM project_access_links pal
  WHERE pal.token = p_token;
  
  IF NOT FOUND OR v_role != 'admin' THEN
    RETURN false;
  END IF;
  
  DELETE FROM projects WHERE id = v_project_id;
  RETURN true;
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.beam_elements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trucks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plans;
