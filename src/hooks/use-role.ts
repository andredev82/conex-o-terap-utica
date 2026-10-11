import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function useHasRole(role: "therapist" | "admin") {
  return useQuery({
    queryKey: ["has-role", role],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", role)
        .maybeSingle();
      return !!data;
    },
    staleTime: 60_000,
  });
}

export const useIsTherapist = () => useHasRole("therapist");
export const useIsAdmin = () => useHasRole("admin");
