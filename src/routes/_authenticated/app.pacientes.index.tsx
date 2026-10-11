import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, ChevronRight, Users, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useIsTherapist } from "@/hooks/use-role";
import { invitePatientByEmail } from "@/lib/therapist.functions";

export const Route = createFileRoute("/_authenticated/app/pacientes/")({
  component: PatientsPage,
});

type Council = Database["public"]["Enums"]["professional_council"];

type Patient = {
  user_id: string;
  full_name: string | null;
};

const COUNCILS: { value: Council; label: string }[] = [
  { value: "CRP", label: "CRP – Psicologia" },
  { value: "CRM", label: "CRM – Medicina" },
  { value: "CREFITO", label: "CREFITO – Fisioterapia / Terapia ocupacional" },
  { value: "CREFONO", label: "CREFONO – Fonoaudiologia" },
  { value: "COFFITO", label: "COFFITO" },
  { value: "outro", label: "Outro conselho" },
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const inputClass =
  "w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

function PatientsPage() {
  const { data: isTherapist, isLoading } = useIsTherapist();

  if (isLoading) {
    return (
      <AppShell>
        <div className="py-20 text-center text-sm text-muted-foreground">Carregando...</div>
      </AppShell>
    );
  }

  return isTherapist ? <TherapistPanel /> : <AccessRequest />;
}

/* ------------------------------------------------------------------ */
/* Quem ainda não é terapeuta: solicitação de acesso profissional      */
/* ------------------------------------------------------------------ */
function AccessRequest() {
  const qc = useQueryClient();
  const [council, setCouncil] = useState<Council | "">("");
  const [registration, setRegistration] = useState("");
  const [uf, setUf] = useState("");

  const { data: verification, isLoading } = useQuery({
    queryKey: ["my-verification"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("therapist_verifications")
        .select("status")
        .eq("user_id", u.user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const request = useMutation({
    mutationFn: async () => {
      const reg = registration.trim();
      if (!council || !uf || !reg) throw new Error("Preencha todos os campos.");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("therapist_verifications").insert({
        user_id: u.user!.id,
        council,
        registration_number: reg,
        uf,
      });
      if (error) throw new Error("Não foi possível enviar a solicitação.");
    },
    onSuccess: () => {
      toast.success("Solicitação enviada.");
      qc.invalidateQueries({ queryKey: ["my-verification"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível enviar."),
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="py-20 text-center text-sm text-muted-foreground">Carregando...</div>
      </AppShell>
    );
  }

  const status = verification?.status;

  return (
    <AppShell>
      <PageHeader
        title="Painel do terapeuta"
        subtitle="Acompanhe seus pacientes entre as consultas."
      />

      {status === "pending" && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
            <Clock className="size-7" />
          </span>
          <h2 className="text-lg font-semibold">Solicitação em análise</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Recebemos seus dados profissionais. Assim que forem conferidos, o painel será liberado
            nesta tela.
          </p>
        </div>
      )}

      {status === "rejected" && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold">Solicitação não aprovada</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Sua solicitação não foi aprovada. Entre em contato com o suporte para mais informações.
          </p>
        </div>
      )}

      {status === "approved" && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold">Acesso aprovado</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Seu acesso foi aprovado. Atualize a página para ver o painel.
          </p>
        </div>
      )}

      {!status && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate();
          }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="mb-4 text-center">
            <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
              <Sparkles className="size-7" />
            </span>
            <h2 className="text-lg font-semibold">Solicitar acesso profissional</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Para vincular pacientes e acompanhar diários e emoções, precisamos conferir seu
              registro profissional.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="council" className="mb-1.5 block text-sm font-medium">
                Conselho profissional
              </label>
              <select
                id="council"
                value={council}
                onChange={(e) => setCouncil(e.target.value as Council | "")}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                {COUNCILS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label htmlFor="registration" className="mb-1.5 block text-sm font-medium">
                  Número de registro
                </label>
                <input
                  id="registration"
                  value={registration}
                  onChange={(e) => setRegistration(e.target.value)}
                  maxLength={30}
                  placeholder="Ex: 06/12345"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="uf" className="mb-1.5 block text-sm font-medium">
                  UF
                </label>
                <select
                  id="uf"
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                  className={inputClass}
                >
                  <option value="">--</option>
                  {UFS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={request.isPending}
              className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {request.isPending ? "Enviando..." : "Enviar solicitação"}
            </button>
          </div>
        </form>
      )}
    </AppShell>
  );
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
