CREATE OR REPLACE FUNCTION public.adv_tracking_dates() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NOT NEW.echeance_manuelle THEN
  IF TG_OP = 'INSERT' THEN
   IF NEW.date_echeance IS NULL THEN
    NEW.date_echeance := (NEW.date_obtention + interval '1 year')::date;
   END IF;
  ELSIF NEW.date_echeance IS NULL
    OR (OLD.date_obtention IS NOT NULL AND NEW.date_obtention IS DISTINCT FROM OLD.date_obtention)
    OR OLD.echeance_manuelle THEN
   NEW.date_echeance := (NEW.date_obtention + interval '1 year')::date;
  END IF;
 END IF;
 NEW.updated_at := now();
 RETURN NEW;
END $$;