ALTER TABLE public.projects ADD COLUMN database_complete boolean NOT NULL DEFAULT false;
ALTER TABLE public.projects ADD COLUMN database_comment text DEFAULT '';