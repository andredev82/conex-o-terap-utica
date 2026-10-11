import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
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

function AdminTherapistsPage() {
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <AppShell>
        <div className="py-20 text-center text-sm text-muted-foreground">Carregando...</div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="py-20 text-center text-sm text-muted-foreground">
          Acesso restrito a administradores.
        </div>
      </AppShell>
    );
  }

  return <PendingList />;
}

type Decision = "approved" | "rejected";

function PendingList() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<{ id: string; name: string; decision: Decision } | null>(
    null,
  );

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

  return (
    <AppShell>
      <PageHeader
        title="Solicitações de terapeutas"
        subtitle="Confira o registro profissional no site do conselho antes de aprovar."
      />

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

      <div className="grid gap-3">
        {data?.map((r) => {
          const name = r.full_name?.trim() || r.email || "Sem nome";
          return (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="font-semibold">{name}</p>
              {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
              <p className="mt-2 text-sm">
                {r.council} {r.registration_number} / {r.uf}
              </p>
              <p className="text-xs text-muted-foreground">
                Enviada em {format(new Date(r.created_at), "d MMM yyyy, HH:mm", { locale: ptBR })}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setConfirm({ id: r.id, name, decision: "approved" })}
                  disabled={review.isPending}
                  className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  Aprovar
                </button>
                <button
                  onClick={() => setConfirm({ id: r.id, name, decision: "rejected" })}
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
                ? `${confirm?.name} poderá convidar pacientes e, após o aceite deles, ver os dados de acompanhamento.`
                : `${confirm?.name} não terá acesso ao painel de terapeuta e não poderá reenviar a solicitação.`}
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
    </AppShell>
  );
}
