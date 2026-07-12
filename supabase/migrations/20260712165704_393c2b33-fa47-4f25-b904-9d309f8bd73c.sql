CREATE TABLE public.tool_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_key text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_entries TO authenticated;
GRANT ALL ON public.tool_entries TO service_role;

ALTER TABLE public.tool_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own tool entries"
  ON public.tool_entries FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Therapists can view their patients tool entries"
  ON public.tool_entries FOR SELECT
  TO authenticated
  USING (public.is_therapist_of(auth.uid(), user_id));

CREATE INDEX idx_tool_entries_user_tool ON public.tool_entries (user_id, tool_key, created_at DESC);

CREATE TRIGGER update_tool_entries_updated_at
  BEFORE UPDATE ON public.tool_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();