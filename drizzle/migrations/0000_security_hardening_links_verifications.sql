DO $$ BEGIN
  CREATE TYPE public.professional_council AS ENUM ('CRP','CRM','CREFITO','CREFONO','COFFITO','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.link_status AS ENUM ('pending','accepted','declined','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.therapist_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  council public.professional_council NOT NULL,
  registration_number text NOT NULL CHECK (char_length(registration_number) BETWEEN 1 AND 30),
  uf char(2) NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
  status public.verification_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
GRANT SELECT, INSERT ON public.therapist_verifications TO authenticated;
GRANT UPDATE (status, reviewed_at, reviewed_by) ON public.therapist_verifications TO authenticated;
GRANT ALL ON public.therapist_verifications TO service_role;
ALTER TABLE public.therapist_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own verification select" ON public.therapist_verifications;
CREATE POLICY "Own verification select" ON public.therapist_verifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Own verification insert pending" ON public.therapist_verifications;
CREATE POLICY "Own verification insert pending" ON public.therapist_verifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL);
DROP POLICY IF EXISTS "Admin verification select" ON public.therapist_verifications;
CREATE POLICY "Admin verification select" ON public.therapist_verifications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admin verification update" ON public.therapist_verifications;
CREATE POLICY "Admin verification update" ON public.therapist_verifications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.therapist_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  status public.link_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (therapist_id <> patient_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS therapist_links_pair_uidx ON public.therapist_links (therapist_id, patient_id);
CREATE INDEX IF NOT EXISTS therapist_links_patient_idx ON public.therapist_links (patient_id);
GRANT SELECT, INSERT ON public.therapist_links TO authenticated;
GRANT UPDATE (status) ON public.therapist_links TO authenticated;
GRANT ALL ON public.therapist_links TO service_role;
ALTER TABLE public.therapist_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapist sees own links" ON public.therapist_links;
CREATE POLICY "Therapist sees own links" ON public.therapist_links
  FOR SELECT TO authenticated USING (auth.uid() = therapist_id);
DROP POLICY IF EXISTS "Patient sees own links" ON public.therapist_links;
CREATE POLICY "Patient sees own links" ON public.therapist_links
  FOR SELECT TO authenticated USING (auth.uid() = patient_id);
DROP POLICY IF EXISTS "Therapist creates pending invite" ON public.therapist_links;
CREATE POLICY "Therapist creates pending invite" ON public.therapist_links
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = therapist_id AND status = 'pending' AND public.has_role(auth.uid(), 'therapist'));
DROP POLICY IF EXISTS "Patient responds to link" ON public.therapist_links;
CREATE POLICY "Patient responds to link" ON public.therapist_links
  FOR UPDATE TO authenticated
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id AND status IN ('accepted','declined','revoked'));
DROP POLICY IF EXISTS "Therapist revokes link" ON public.therapist_links;
CREATE POLICY "Therapist revokes link" ON public.therapist_links
  FOR UPDATE TO authenticated
  USING (auth.uid() = therapist_id)
  WITH CHECK (auth.uid() = therapist_id AND status = 'revoked');

CREATE OR REPLACE FUNCTION public.therapist_links_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.therapist_id <> OLD.therapist_id OR NEW.patient_id <> OLD.patient_id THEN
    RAISE EXCEPTION 'Vínculo não pode ser reatribuído';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('accepted','declined') AND OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Somente convites pendentes podem ser respondidos';
    END IF;
    NEW.responded_at = now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS therapist_links_before_update ON public.therapist_links;
CREATE TRIGGER therapist_links_before_update BEFORE UPDATE ON public.therapist_links
  FOR EACH ROW EXECUTE FUNCTION public.therapist_links_before_update();

CREATE OR REPLACE FUNCTION public.is_therapist_of(_therapist uuid, _patient uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_therapist, 'therapist') AND EXISTS (
    SELECT 1 FROM public.therapist_links
    WHERE therapist_id = _therapist AND patient_id = _patient AND status = 'accepted'
  );
$$;

INSERT INTO public.therapist_links (therapist_id, patient_id, status)
SELECT therapist_id, user_id, 'pending' FROM public.profiles
WHERE therapist_id IS NOT NULL AND therapist_id <> user_id
ON CONFLICT (therapist_id, patient_id) DO NOTHING;
COMMENT ON COLUMN public.profiles.therapist_id IS 'DEPRECATED: replaced by public.therapist_links';

CREATE OR REPLACE FUNCTION public.therapist_links_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.therapist_links
      WHERE therapist_id = NEW.therapist_id AND status = 'pending') >= 20 THEN
    RAISE EXCEPTION 'Limite de convites pendentes atingido';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS therapist_links_before_insert ON public.therapist_links;
CREATE TRIGGER therapist_links_before_insert BEFORE INSERT ON public.therapist_links
  FOR EACH ROW EXECUTE FUNCTION public.therapist_links_before_insert();

CREATE OR REPLACE FUNCTION public.my_therapist_links()
RETURNS TABLE (id uuid, therapist_id uuid, status public.link_status, created_at timestamptz,
               therapist_name text, council public.professional_council)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.therapist_id, l.status, l.created_at, p.full_name, v.council
  FROM public.therapist_links l
  LEFT JOIN public.profiles p ON p.user_id = l.therapist_id
  LEFT JOIN public.therapist_verifications v ON v.user_id = l.therapist_id AND v.status = 'approved'
  WHERE l.patient_id = auth.uid() AND l.status IN ('pending','accepted')
  ORDER BY l.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.my_therapist_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_therapist_links() TO authenticated;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
UPDATE public.profiles p SET email = lower(u.email)
FROM auth.users u WHERE u.id = p.user_id AND p.email IS NULL AND u.email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_uidx ON public.profiles (email);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', lower(NEW.email))
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'patient') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users select own profile" ON public.profiles;
CREATE POLICY "Users select own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT (user_id, full_name, therapist_name, therapist_specialty) ON public.profiles TO authenticated;
GRANT UPDATE (full_name, therapist_name, therapist_specialty) ON public.profiles TO authenticated;