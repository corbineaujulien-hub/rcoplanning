-- Update create_project to only create one link (no roles)
CREATE OR REPLACE FUNCTION public.create_project()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_project_id uuid;
  project_token text;
BEGIN
  INSERT INTO projects DEFAULT VALUES RETURNING id INTO new_project_id;
  
  INSERT INTO project_access_links (project_id, role, label)
  VALUES (new_project_id, 'admin', 'Lien principal')
  RETURNING token INTO project_token;
  
  RETURN jsonb_build_object(
    'project_id', new_project_id,
    'token', project_token
  );
END;
$$;

-- Update validate_token to not return role
CREATE OR REPLACE FUNCTION public.validate_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  link_record record;
BEGIN
  SELECT pal.project_id, p.site_name
  INTO link_record
  FROM project_access_links pal
  JOIN projects p ON p.id = pal.project_id
  WHERE pal.token = p_token;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  RETURN jsonb_build_object(
    'project_id', link_record.project_id,
    'site_name', link_record.site_name
  );
END;
$$;

-- Update delete_project to work without role check
CREATE OR REPLACE FUNCTION public.delete_project(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  SELECT pal.project_id INTO v_project_id
  FROM project_access_links pal
  WHERE pal.token = p_token;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  DELETE FROM projects WHERE id = v_project_id;
  RETURN true;
END;
$$;

-- Add a direct delete function by project id
CREATE OR REPLACE FUNCTION public.delete_project_by_id(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM projects WHERE id = p_project_id;
  RETURN FOUND;
END;
$$;