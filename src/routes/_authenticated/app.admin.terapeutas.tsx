import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { useIsAdmin } from "@/hooks/use-role";
import { listPendingVerifications, reviewVerification } from "@/lib/therapist.functions";
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

export const Route = createFileRoute("/_authenticated/app/admin/terapeutas")({
  component: AdminTherapistsPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  psicologo: "Psicólogo(a)",
  psiquiatra: "Psiquiatra",
  psicanalista: "Psicanalista",
  terapeuta_holistico: "Terapeuta holístico / integrativo",
  outro: "Outro profissional",
};

// Consultas públicas oficiais dos conselhos (abrem em nova aba).
const CHECK_LINK: Record<string, { url: string; label: string }> = {
  psicologo: {
    url: "https://cadastro.cfp.org.br/",
    label: "Consultar no Cadastro Nacional do CFP",
  },
  psiquiatra: {
    url: "https://portal.cfm.org.br/busca-medicos",
    label: "Consultar na Busca por Médicos do CFM",
  },
};

function AdminTherapistsPage() {
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">Carregando...</div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-sm py-20 text-center">
        <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
        <Link to="/app" className="mt-3 inline-block text-sm font-medium text-primary underline">
          Voltar ao app
        </Link>
      </div>
    );
  }

  return <PendingList />;
}

type Decision = "approved" | "rejected";

function PendingList() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<{
    id: string;
    name: string;
    category: string;
    decision: Decision;
  } | null>(null);

  const listFn = useServerFn(listPendingVerifications);
  const reviewFn = useServerFn(reviewVerification);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["pending-verifications"],
    queryFn: () => listFn(),
  });

  const review = useMutation({
    mutationFn: (v: { id: string; decision: Decision }) => reviewFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.decision === "approved" ? "Profissional aprovado." : "Solicitação rejeitada.");
      qc.invalidateQueries({ queryKey: ["pending-verifications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível concluir."),
  });

  const hasCouncil = (c: string) => c === "psicologo" || c === "psiquiatra";

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold md:text-3xl">Solicitações pendentes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data
            ? data.length === 1
              ? "1 solicitação aguardando análise."
              : `${data.length} solicitações aguardando análise.`
            : "Confira os dados antes de aprovar."}
        </p>
      </div>

      {isLoading && (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
      )}

      {isError && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Não foi possível carregar as solicitações.
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
          Nenhuma solicitação pendente.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((r) => {
          const name = r.full_name?.trim() || r.email || "Sem nome";
          const check = CHECK_LINK[r.category];
          const council = hasCouncil(r.category);
          return (
            <div key={r.id} className="flex flex-col rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{name}</p>
                  {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
                </div>
                <span
                  className={
                    council
                      ? "shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                      : "shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {CATEGORY_LABEL[r.category] ?? r.category}
                </span>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                {council ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{r.council}</dt>
                    <dd className="font-medium">
                      {r.registration_number} / {r.uf}
                    </dd>
                  </div>
                ) : (
                  r.registration_number && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Registro em associação</dt>
                      <dd className="font-medium">
                        {r.registration_number}
                        {r.uf ? ` / ${r.uf}` : ""}
                      </dd>
                    </div>
                  )
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Enviada em</dt>
                  <dd>{format(new Date(r.created_at), "d MMM yyyy, HH:mm", { locale: ptBR })}</dd>
                </div>
              </dl>

              {r.proof_note && (
                <div className="mt-3 rounded-xl bg-muted/60 p-3">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">
                    {council ? "Observações" : "Formação e vínculo informados"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{r.proof_note}</p>
                </div>
              )}

              {check ? (
                <a
                  href={check.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 rounded-full border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <ExternalLink className="size-4" />
                  {check.label}
                </a>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  Sem conselho profissional: a análise é manual. Avalie a formação e o vínculo
                  informados, e peça documentos adicionais se precisar.
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() =>
                    setConfirm({ id: r.id, name, category: r.category, decision: "approved" })
                  }
                  disabled={review.isPending}
                  className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  Aprovar
                </button>
                <button
                  onClick={() =>
                    setConfirm({ id: r.id, name, category: r.category, decision: "rejected" })
                  }
                  disabled={review.isPending}
                  className="flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-accent disabled:opacity-60"
                >
                  Rejeitar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.decision === "approved" ? "Aprovar profissional?" : "Rejeitar solicitação?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.decision === "approved"
                ? confirm && hasCouncil(confirm.category)
                  ? `Confirme que você conferiu o registro de ${confirm.name} na consulta pública do conselho (nome e situação ativa). Ele poderá convidar pacientes e, depois do aceite deles, acompanhar os dados do plano terapêutico.`
                  : `${confirm?.name} não tem conselho profissional. Aprove somente se a formação e o vínculo informados forem suficientes. O acesso será limitado ao que a categoria permite.`
                : `${confirm?.name} não terá acesso ao painel do profissional e não poderá reenviar a solicitação.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) review.mutate({ id: confirm.id, decision: confirm.decision });
                setConfirm(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
