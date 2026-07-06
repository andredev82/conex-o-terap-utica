import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, ChevronRight, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useIsTherapist } from "@/hooks/use-role";
import { becomeTherapist, linkPatientByEmail } from "@/lib/therapist.functions";

export const Route = createFileRoute("/_authenticated/app/pacientes/")({
  component: PatientsPage,
});

type Patient = {
  user_id: string;
  full_name: string | null;
};

function PatientsPage() {
  const qc = useQueryClient();
  const { data: isTherapist, isLoading: roleLoading } = useIsTherapist();
  const [email, setEmail] = useState("");

  const activate = useMutation({
    mutationFn: () => becomeTherapist(),
    onSuccess: () => {
      toast.success("Modo terapeuta ativado.");
      qc.invalidateQueries({ queryKey: ["is-therapist"] });
    },
    onError: () => toast.error("Não foi possível ativar."),
  });

  const linkFn = useServerFn(linkPatientByEmail);
  const addPatient = useMutation({
    mutationFn: (payload: { email: string }) => linkFn({ data: payload }),
    onSuccess: () => {
      toast.success("Paciente vinculado.");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["my-patients"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível vincular."),
  });

  const { data: patients } = useQuery({
    queryKey: ["my-patients"],
    enabled: !!isTherapist,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("therapist_id", u.user!.id)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data as Patient[];
    },
  });

  if (roleLoading) {
    return (
      <AppShell>
        <div className="py-20 text-center text-sm text-muted-foreground">Carregando...</div>
      </AppShell>
    );
  }

  if (!isTherapist) {
    return (
      <AppShell>
        <PageHeader title="Painel do terapeuta" subtitle="Acompanhe seus pacientes entre as consultas." />
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
            <Sparkles className="size-7" />
          </span>
          <h2 className="text-lg font-semibold">Você é um profissional?</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Ative o modo terapeuta para vincular pacientes, acompanhar diários e emoções, e responder
            mensagens em tempo real.
          </p>
          <button
            onClick={() => activate.mutate()}
            disabled={activate.isPending}
            className="mt-5 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {activate.isPending ? "Ativando..." : "Ativar modo terapeuta"}
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Meus pacientes" subtitle="Acompanhe e converse com quem você atende." />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) addPatient.mutate({ email: email.trim() });
        }}
        className="mb-6 rounded-2xl border border-border bg-card p-4"
      >
        <label className="mb-1.5 block text-sm font-medium">Adicionar paciente por e-mail</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="paciente@email.com"
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="submit"
            disabled={addPatient.isPending || !email.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <UserPlus className="size-4" />
            Vincular
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          O paciente já precisa ter uma conta no Sereno com esse e-mail.
        </p>
      </form>

      {patients && patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <Users className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum paciente vinculado ainda. Adicione o primeiro acima.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {patients?.map((p) => (
            <Link
              key={p.user_id}
              to="/app/pacientes/$patientId"
              params={{ patientId: p.user_id }}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-serif text-lg font-semibold text-secondary-foreground">
                {(p.full_name?.trim()[0] ?? "?").toUpperCase()}
              </span>
              <div className="flex-1">
                <h3 className="font-semibold">{p.full_name?.trim() || "Paciente"}</h3>
                <p className="text-xs text-muted-foreground">Ver acompanhamento e conversa</p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
