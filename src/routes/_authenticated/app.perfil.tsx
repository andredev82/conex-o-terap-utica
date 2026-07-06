import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/perfil")({
  component: ProfilePage,
});

const SPECIALTIES = [
  { value: "psychology", label: "Psicologia" },
  { value: "occupational_therapy", label: "Terapia ocupacional" },
  { value: "psychiatry", label: "Psiquiatria" },
  { value: "physiotherapy", label: "Fisioterapia" },
  { value: "speech_therapy", label: "Fonoaudiologia" },
  { value: "other", label: "Outra" },
] as const;

function ProfilePage() {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [therapistName, setTherapistName] = useState("");
  const [specialty, setSpecialty] = useState<string>("");
  const [email, setEmail] = useState("");

  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", u.user!.id)
        .maybeSingle();
      return { profile, email: u.user?.email ?? "" };
    },
  });

  useEffect(() => {
    if (data) {
      setFullName(data.profile?.full_name ?? "");
      setTherapistName(data.profile?.therapist_name ?? "");
      setSpecialty(data.profile?.therapist_specialty ?? "");
      setEmail(data.email);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          therapist_name: therapistName.trim() || null,
          therapist_specialty: (specialty || null) as never,
        })
        .eq("user_id", u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: () => toast.error("Não foi possível salvar."),
  });

  return (
    <AppShell>
      <PageHeader title="Seu perfil" subtitle="Ajuste seus dados e quem acompanha você." />

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Seu nome</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">E-mail</label>
            <input
              value={email}
              disabled
              className="w-full rounded-xl border border-input bg-muted px-4 py-2.5 text-sm text-muted-foreground"
            />
          </div>
          <hr className="border-border" />
          <div>
            <label className="mb-1.5 block text-sm font-medium">Nome do profissional que acompanha você</label>
            <input
              value={therapistName}
              onChange={(e) => setTherapistName(e.target.value)}
              placeholder="Ex: Dra. Ana"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Especialidade</label>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Selecione...</option>
              {SPECIALTIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {save.isPending ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
