import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, ChevronRight, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useIsTherapist } from "@/hooks/use-role";
import { invitePatientByEmail } from "@/lib/therapist.functions";
import { ProfessionalRequest } from "@/components/ProfessionalRequest";

export const Route = createFileRoute("/_authenticated/app/pacientes/")({
  component: PatientsPage,
});

type Patient = {
  user_id: string;
  full_name: string | null;
};

function PatientsPage() {
  const { data: isTherapist, isLoading } = useIsTherapist();

  if (isLoading) {
    return (
      <AppShell>
        <div className="py-20 text-center text-sm text-muted-foreground">Carregando...</div>
      </AppShell>
    );
  }

  return isTherapist ? <TherapistPanel /> : <ProfessionalRequest />;
}

/* ------------------------------------------------------------------ */
/* Terapeuta aprovado: convites e lista de pacientes com vínculo aceito */
/* ------------------------------------------------------------------ */
function TherapistPanel() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const inviteFn = useServerFn(invitePatientByEmail);
  const invite = useMutation({
    mutationFn: (payload: { email: string }) => inviteFn({ data: payload }),
    onSuccess: (res) => {
      toast.success(res.message);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["my-patients"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o convite."),
  });

  const { data } = useQuery({
    queryKey: ["my-patients"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: links, error } = await supabase
        .from("therapist_links")
        .select("patient_id, status")
        .eq("therapist_id", u.user!.id)
        .in("status", ["pending", "accepted"]);
      if (error) throw error;

      const acceptedIds = links.filter((l) => l.status === "accepted").map((l) => l.patient_id);
      const pending = links.filter((l) => l.status === "pending").length;

      let patients: Patient[] = [];
      if (acceptedIds.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", acceptedIds)
          .order("full_name", { ascending: true });
        if (pErr) throw pErr;
        patients = profs as Patient[];
      }
      return { patients, pending };
    },
  });

  return (
    <AppShell>
      <PageHeader title="Meus pacientes" subtitle="Acompanhe e converse com quem você atende." />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) invite.mutate({ email: email.trim() });
        }}
        className="mb-6 rounded-2xl border border-border bg-card p-4"
      >
        <label htmlFor="invite-email" className="mb-1.5 block text-sm font-medium">
          Convidar paciente por e-mail
        </label>
        <div className="flex gap-2">
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="paciente@email.com"
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="submit"
            disabled={invite.isPending || !email.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <UserPlus className="size-4" />
            Convidar
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          O paciente recebe o convite no próprio perfil e só passa a ser acompanhado depois de
          aceitar. Você terá acesso aos dados dele somente após o aceite.
        </p>
      </form>

      {data && data.pending > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <Clock className="size-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {data.pending === 1
              ? "1 convite aguardando resposta do paciente."
              : `${data.pending} convites aguardando resposta dos pacientes.`}
          </p>
        </div>
      )}

      {data && data.patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <Users className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum paciente com vínculo aceito ainda. Envie o primeiro convite acima.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {data?.patients.map((p) => (
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
