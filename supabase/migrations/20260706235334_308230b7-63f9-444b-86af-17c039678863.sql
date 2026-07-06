
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS therapist_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_therapist_id_idx ON public.profiles (therapist_id);

CREATE OR REPLACE FUNCTION public.is_therapist_of(_therapist uuid, _patient uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _patient AND therapist_id = _therapist
  );
$$;

-- Therapist can read their patients' profiles
CREATE POLICY "Therapist reads own patients profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_therapist_of(auth.uid(), user_id));

-- Therapist can read their patients' diary entries
CREATE POLICY "Therapist reads patient diary"
ON public.diary_entries FOR SELECT TO authenticated
USING (public.is_therapist_of(auth.uid(), user_id));

-- Therapist can read their patients' mood entries
CREATE POLICY "Therapist reads patient moods"
ON public.mood_entries FOR SELECT TO authenticated
USING (public.is_therapist_of(auth.uid(), user_id));

-- Therapist can read messages of their patients
CREATE POLICY "Therapist reads patient thread"
ON public.messages FOR SELECT TO authenticated
USING (public.is_therapist_of(auth.uid(), patient_id));

-- Therapist can send messages to their patients
CREATE POLICY "Therapist sends messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id AND public.is_therapist_of(auth.uid(), patient_id));
