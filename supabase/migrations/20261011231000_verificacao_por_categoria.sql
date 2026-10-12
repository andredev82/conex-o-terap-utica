-- Verificação profissional por categoria. Já aplicado no banco do Lovable Cloud em 11/10/2026.
-- Psicólogo e psiquiatra exigem conselho (CRP / CRM), registro e UF.
-- Demais categorias exigem descrição de formação e vínculo (mín. 20 caracteres).

ALTER TABLE public.therapist_verifications
  ALTER COLUMN council DROP NOT NULL,
  ALTER COLUMN registration_number DROP NOT NULL,
  ALTER COLUMN uf DROP NOT NULL,
  ALTER COLUMN category SET NOT NULL;

ALTER TABLE public.therapist_verifications DROP CONSTRAINT IF EXISTS therapist_verifications_category_chk;
ALTER TABLE public.therapist_verifications ADD CONSTRAINT therapist_verifications_category_chk CHECK (
  (category = 'psicologo' AND council = 'CRP' AND registration_number IS NOT NULL AND uf IS NOT NULL)
  OR (category = 'psiquiatra' AND council = 'CRM' AND registration_number IS NOT NULL AND uf IS NOT NULL)
  OR (category IN ('psicanalista','terapeuta_holistico','outro') AND proof_note IS NOT NULL AND char_length(proof_note) >= 20)
);

DROP FUNCTION IF EXISTS public.my_therapist_links();
CREATE FUNCTION public.my_therapist_links()
RETURNS TABLE(id uuid, therapist_id uuid, status link_status, created_at timestamptz, therapist_name text, council professional_council, category professional_category)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT l.id, l.therapist_id, l.status, l.created_at, p.full_name, v.council, v.category
  FROM public.therapist_links l
  LEFT JOIN public.profiles p ON p.user_id = l.therapist_id
  LEFT JOIN public.therapist_verifications v ON v.user_id = l.therapist_id AND v.status = 'approved'
  WHERE l.patient_id = auth.uid() AND l.status IN ('pending','accepted')
  ORDER BY l.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.my_therapist_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_therapist_links() TO authenticated;
