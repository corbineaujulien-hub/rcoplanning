ALTER TABLE public.trucks
ADD COLUMN IF NOT EXISTS forced_category TEXT,
ADD COLUMN IF NOT EXISTS forced_category_reason TEXT;