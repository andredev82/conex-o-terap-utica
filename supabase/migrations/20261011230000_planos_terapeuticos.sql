-- Categorias profissionais, planos terapêuticos e anotações
-- Aditivo: não altera políticas existentes. Já aplicado no banco do Lovable Cloud em 11/10/2026.

DO $$ BEGIN
  CREATE TYPE public.professional_category AS ENUM ('psicologo','psiquiatra','psicanalista','terapeuta_holistico','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_item_kind AS ENUM ('diary','mood','assessment','tool');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_frequency AS ENUM ('once','daily','weekly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.therapist_verifications
  ADD COLUMN IF NOT EXISTS category public.professional_category,
  ADD COLUMN IF NOT EXISTS proof_note text CHECK (proof_note IS NULL OR char_length(proof_note) <= 1000);

CREATE OR REPLACE FUNCTION public.therapist_category(_user_id uuid)
RETURNS public.professional_category
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT category FROM public.therapist_verifications
  WHERE user_id = _user_id AND status = 'approved' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.therapist_category(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.therapist_category(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.assessment_access (
  type public.assessment_type PRIMARY KEY,
  restricted_to_psychologist boolean NOT NULL DEFAULT false
);
ALTER TABLE public.assessment_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assessment_access FROM anon, authenticated;
GRANT SELECT ON public.assessment_access TO authenticated;
DROP POLICY IF EXISTS "Authenticated read assessment access" ON public.assessment_access;
CREATE POLICY "Authenticated read assessment access" ON public.assessment_access
  FOR SELECT TO authenticated USING (true);
INSERT INTO public.assessment_access (type)
  SELECT unnest(enum_range(NULL::public.assessment_type)) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_assign_assessment(_therapist uuid, _type public.assessment_type)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_therapist, 'therapist')
    AND COALESCE(
      (SELECT (NOT a.restricted_to_psychologist) OR public.therapist_category(_therapist) = 'psicologo'
         FROM public.assessment_access a WHERE a.type = _type),
      true)
$$;
REVOKE ALL ON FUNCTION public.can_assign_assessment(uuid, public.assessment_type) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_assign_assessment(uuid, public.assessment_type) TO authenticated;

CREATE TABLE IF NOT EXISTS public.plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.plan_item_kind NOT NULL,
  assessment_type public.assessment_type,
  tool_key text,
  instructions text CHECK (instructions IS NULL OR char_length(instructions) <= 1000),
  frequency public.plan_frequency NOT NULL DEFAULT 'once',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_items_assessment_chk CHECK ((kind = 'assessment') = (assessment_type IS NOT NULL)),
  CONSTRAINT plan_items_tool_chk CHECK ((kind = 'tool') = (tool_key IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS plan_items_patient_idx ON public.plan_items (patient_id, active);
CREATE INDEX IF NOT EXISTS plan_items_therapist_idx ON public.plan_items (therapist_id, patient_id);
ALTER TABLE public.plan_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_items FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_items TO authenticated;

DROP POLICY IF EXISTS "Therapist reads own plan items" ON public.plan_items;
CREATE POLICY "Therapist reads own plan items" ON public.plan_items
  FOR SELECT TO authenticated
  USING (therapist_id = auth.uid() AND public.is_therapist_of(auth.uid(), patient_id));
DROP POLICY IF EXISTS "Patient reads active plan items" ON public.plan_items;
CREATE POLICY "Patient reads active plan items" ON public.plan_items
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid() AND active AND public.is_therapist_of(therapist_id, patient_id));
DROP POLICY IF EXISTS "Therapist creates plan items" ON public.plan_items;
CREATE POLICY "Therapist creates plan items" ON public.plan_items
  FOR INSERT TO authenticated
  WITH CHECK (
    therapist_id = auth.uid()
    AND public.is_therapist_of(auth.uid(), patient_id)
    AND (kind <> 'assessment' OR public.can_assign_assessment(auth.uid(), assessment_type))
  );
DROP POLICY IF EXISTS "Therapist updates own plan items" ON public.plan_items;
CREATE POLICY "Therapist updates own plan items" ON public.plan_items
  FOR UPDATE TO authenticated
  USING (therapist_id = auth.uid() AND public.is_therapist_of(auth.uid(), patient_id))
  WITH CHECK (
    therapist_id = auth.uid()
    AND public.is_therapist_of(auth.uid(), patient_id)
    AND (kind <> 'assessment' OR public.can_assign_assessment(auth.uid(), assessment_type))
  );
DROP POLICY IF EXISTS "Therapist deletes own plan items" ON public.plan_items;
CREATE POLICY "Therapist deletes own plan items" ON public.plan_items
  FOR DELETE TO authenticated
  USING (therapist_id = auth.uid());

DROP TRIGGER IF EXISTS update_plan_items_updated_at ON public.plan_items;
CREATE TRIGGER update_plan_items_updated_at BEFORE UPDATE ON public.plan_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.therapist_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS therapist_notes_idx ON public.therapist_notes (therapist_id, patient_id, created_at DESC);
ALTER TABLE public.therapist_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.therapist_notes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.therapist_notes TO authenticated;
DROP POLICY IF EXISTS "Therapist reads own notes" ON public.therapist_notes;
CREATE POLICY "Therapist reads own notes" ON public.therapist_notes
  FOR SELECT TO authenticated USING (therapist_id = auth.uid());
DROP POLICY IF EXISTS "Therapist creates notes" ON public.therapist_notes;
CREATE POLICY "Therapist creates notes" ON public.therapist_notes
  FOR INSERT TO authenticated
  WITH CHECK (therapist_id = auth.uid() AND public.is_therapist_of(auth.uid(), patient_id));
DROP POLICY IF EXISTS "Therapist updates own notes" ON public.therapist_notes;
CREATE POLICY "Therapist updates own notes" ON public.therapist_notes
  FOR UPDATE TO authenticated
  USING (therapist_id = auth.uid() AND public.is_therapist_of(auth.uid(), patient_id))
  WITH CHECK (therapist_id = auth.uid() AND public.is_therapist_of(auth.uid(), patient_id));
DROP TRIGGER IF EXISTS update_therapist_notes_updated_at ON public.therapist_notes;
CREATE TRIGGER update_therapist_notes_updated_at BEFORE UPDATE ON public.therapist_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Marcação de origem nos registros do paciente
ALTER TABLE public.diary_entries
  ADD COLUMN IF NOT EXISTS therapist_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_item_id uuid REFERENCES public.plan_items(id) ON DELETE SET NULL;
ALTER TABLE public.mood_entries
  ADD COLUMN IF NOT EXISTS therapist_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_item_id uuid REFERENCES public.plan_items(id) ON DELETE SET NULL;
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS therapist_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_item_id uuid REFERENCES public.plan_items(id) ON DELETE SET NULL;
ALTER TABLE public.tool_entries
  ADD COLUMN IF NOT EXISTS therapist_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_item_id uuid REFERENCES public.plan_items(id) ON DELETE SET NULL;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS therapist_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
