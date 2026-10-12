import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/perfil")({
  component: ProfilePage,
});

const inputClass =
  "w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

function ProfilePage() {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
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
      <PageHeader title="Seu perfil" subtitle="Ajuste seus dados e veja quem acompanha você." />

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="space-y-4">
          <div>
            <label htmlFor="full-name" className="mb-1.5 block text-sm font-medium">
              Seu nome
            </label>
            <input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              E-mail
            </label>
            <input
              id="email"
              value={email}
              disabled
              className="w-full rounded-xl border border-input bg-muted px-4 py-2.5 text-sm text-muted-foreground"
            />
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

      <TherapistLinksSection />
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Quem acompanha você: convites e acessos concedidos a terapeutas      */
/* ------------------------------------------------------------------ */
const CATEGORY_LABEL: Record<string, string> = {
  psicologo: "Psicólogo(a)",
  psiquiatra: "Psiquiatra",
  psicanalista: "Psicanalista",
  terapeuta_holistico: "Terapeuta holístico / integrativo",
  outro: "Profissional de saúde",
};

type LinkRow = {
  id: string;
  therapist_id: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  created_at: string;
  therapist_name: string | null;
  council: string | null;
  category: string | null;
};

type LinkStatus = "accepted" | "declined" | "revoked";

function TherapistLinksSection() {
  const qc = useQueryClient();
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const { data: links } = useQuery({
    queryKey: ["my-therapist-links"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_therapist_links");
      if (error) throw error;
      return (data ?? []) as unknown as LinkRow[];
    },
  });

  const respond = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LinkStatus }) => {
      const { error } = await supabase.from("therapist_links").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(
        v.status === "accepted"
          ? "Acesso concedido."
          : v.status === "declined"
            ? "Convite recusado."
            : "Acesso revogado.",
      );
      qc.invalidateQueries({ queryKey: ["my-therapist-links"] });
      qc.invalidateQueries({ queryKey: ["has-accepted-therapist"] });
    },
    onError: () => toast.error("Não foi possível atualizar. Tente novamente."),
  });

  const pending = (links ?? []).filter((l) => l.status === "pending");
  const active = (links ?? []).filter((l) => l.status === "accepted");

  const who = (l: LinkRow) => (
    <div className="flex-1">
      <p className="font-semibold">{l.therapist_name?.trim() || "Profissional"}</p>
      <p className="text-xs text-muted-foreground">
        {l.category ? (CATEGORY_LABEL[l.category] ?? "Profissional de saúde") : "Profissional de saúde"}
      </p>
    </div>
  );

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Quem acompanha você</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Um profissional só vê seu diário, emoções, testes e mensagens depois que você aceita o
        convite. Você pode revogar o acesso quando quiser.
      </p>

      {pending.length > 0 && (
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Convites pendentes</h3>
          {pending.map((l) => (
            <div key={l.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-3">{who(l)}</div>
              <p className="mt-2 text-xs text-muted-foreground">
                Este profissional quer acompanhar você pelo aplicativo.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => respond.mutate({ id: l.id, status: "accepted" })}
                  disabled={respond.isPending}
                  className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  Aceitar
                </button>
                <button
                  onClick={() => respond.mutate({ id: l.id, status: "declined" })}
                  disabled={respond.isPending}
                  className="flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-accent disabled:opacity-60"
                >
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Acesso ativo</h3>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum profissional com acesso no momento.</p>
        ) : (
          active.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-4"
            >
              {who(l)}
              <button
                onClick={() => setRevokeId(l.id)}
                className="rounded-full border border-input px-4 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
              >
                Revogar acesso
              </button>
            </div>
          ))
        )}
      </div>

      <AlertDialog open={!!revokeId} onOpenChange={(o) => !o && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              O profissional deixará de ver seu diário, emoções, testes e mensagens, e o vínculo
              será encerrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revokeId) respond.mutate({ id: revokeId, status: "revoked" });
                setRevokeId(null);
              }}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
