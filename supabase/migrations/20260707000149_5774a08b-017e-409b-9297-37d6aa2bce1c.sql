
DO $$ BEGIN
  CREATE TYPE public.assessment_type AS ENUM ('gad7', 'phq9');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.assessment_type NOT NULL,
  score integer NOT NULL,
  severity text NOT NULL,
  answers integer[] NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assessments_user_type_idx ON public.assessments (user_id, type, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own assessments"
ON public.assessments FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Therapist reads patient assessments"
ON public.assessments FOR SELECT TO authenticated
USING (public.is_therapist_of(auth.uid(), user_id));
