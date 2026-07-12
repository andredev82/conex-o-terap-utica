import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  ASSESSMENTS,
  RESPONSE_OPTIONS,
  computeResult,
  severityToneClass,
  type AssessmentType,
} from "@/lib/assessments";

export const Route = createFileRoute("/_authenticated/app/testes")({
  component: TestsPage,
});

type Row = {
  id: string;
  type: AssessmentType;
  score: number;
  severity: string;
  created_at: string;
};

function TestsPage() {
  const [active, setActive] = useState<AssessmentType | null>(null);

  const { data: history } = useQuery({
    queryKey: ["assessments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id, type, score, severity, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  if (active) {
    return <TakeTest type={active} onDone={() => setActive(null)} />;
  }

  return (
    <AppShell>
      <PageHeader
        title="Testes"
        subtitle="Escalas validadas para acompanhar ansiedade e humor ao longo do tempo."
      />

      <div className="grid gap-4">
        {(Object.keys(ASSESSMENTS) as AssessmentType[]).map((t) => {
          const def = ASSESSMENTS[t];
          const last = history?.find((h) => h.type === t);
          return (
            <div key={t} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <ClipboardList className="size-6" />
                </span>
                <div className="flex-1">
                  <h3 className="font-semibold">{def.name}</h3>
                  <p className="text-sm text-muted-foreground">{def.description}</p>
                  {last && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Último: <span className="font-semibold text-foreground">{last.score}</span> ·{" "}
                      {last.severity} ·{" "}
                      {format(new Date(last.created_at), "d MMM yyyy", { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActive(t)}
                className="mt-4 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Responder {def.short}
              </button>
            </div>
          );
        })}
      </div>

      {history && history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Histórico</h2>
          <div className="grid gap-2">
            {history.map((h) => {
              const def = ASSESSMENTS[h.type];
              const tone = def.severity(h.score).tone;
              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div>
                    <span className="text-sm font-medium">{def.short}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {format(new Date(h.created_at), "d MMM yyyy, HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-lg font-semibold">{h.score}</span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        severityToneClass[tone],
                      )}
                    >
                      {h.severity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function TakeTest({ type, onDone }: { type: AssessmentType; onDone: () => void }) {
  const def = ASSESSMENTS[type];
  const options = def.responseOptions ?? RESPONSE_OPTIONS;
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => Array(def.questions.length).fill(null),
  );

  const result = useMemo(() => computeResult(def, answers), [def, answers]);
  const score = result.score;
  const complete = answers.every((a) => a !== null);

  const save = useMutation({
    mutationFn: async () => {
      if (!complete) throw new Error("incomplete");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("assessments").insert({
        user_id: u.user!.id,
        type,
        score,
        severity: result.label,
        answers: answers as number[],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Teste registrado.", {
        description:
          result.subscales.length > 0
            ? result.subscales
                .map((s) => `${s.name}: ${s.score} (${s.severity.label})`)
                .join(" · ")
            : result.label,
      });
      qc.invalidateQueries({ queryKey: ["assessments"] });
      onDone();
    },
    onError: (e) =>
      toast.error(
        e instanceof Error && e.message === "incomplete"
          ? "Responda todas as perguntas."
          : "Não foi possível salvar.",
      ),
  });

  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onDone}
          className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">{def.name}</h1>
          <p className="text-xs text-muted-foreground">{def.intro}</p>
        </div>
      </div>

      <div className="space-y-4">
        {def.questions.map((q, i) => {
          const qOptions = def.optionsPerQuestion?.[i] ?? options;
          const wide = def.responseOptions || def.optionsPerQuestion;
          return (
            <div key={i} className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-medium">
                {i + 1}. {q}
              </p>
              <div
                className={cn(
                  "grid gap-2",
                  wide ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-4",
                )}
              >
                {qOptions.map((opt) => {
                  const selected = answers[i] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() =>
                        setAnswers((prev) => {
                          const next = [...prev];
                          next[i] = opt.value;
                          return next;
                        })
                      }
                      className={cn(
                        "rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:border-primary/40",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>


      <div className="sticky bottom-20 mt-6 flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:bottom-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {def.higherIsBetter ? "Bem-estar parcial" : "Pontuação parcial"}
          </p>
          <p className="font-serif text-2xl font-semibold text-primary">
            {def.displayScore ? def.displayScore(score) : score}
            {!def.displayScore && (
              <span className="text-sm text-muted-foreground"> / {def.maxScore}</span>
            )}
          </p>
        </div>

        <button
          onClick={() => save.mutate()}
          disabled={!complete || save.isPending}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Check className="size-4" />
          {save.isPending ? "Salvando..." : "Concluir"}
        </button>
      </div>
    </AppShell>
  );
}
