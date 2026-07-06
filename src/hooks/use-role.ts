import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIsTherapist() {
  return useQuery({
    queryKey: ["is-therapist"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "therapist")
        .maybeSingle();
      return !!data;
    },
    staleTime: 60_000,
  });
}
