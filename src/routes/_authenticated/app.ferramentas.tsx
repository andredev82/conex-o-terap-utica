import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Brain, Sparkles, Anchor, NotebookPen, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { TOOLS, TOOL_LIST, type ToolDef, type ToolField } from "@/lib/tools";

export const Route = createFileRoute("/_authenticated/app/ferramentas")({
  component: ToolsPage,
});

const ICONS = { Brain, Sparkles, Anchor, NotebookPen } as const;

type Row = {
  id: string;
  tool_key: string;
  data: Record<string, unknown>;
  created_at: string;
};

function ToolsPage() {
  const [active, setActive] = useState<string | null>(null);

  const { data: history } = useQuery({
    queryKey: ["tool-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tool_entries")
        .select("id, tool_key, data, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  if (active && TOOLS[active]) {
    return <FillTool def={TOOLS[active]} onDone={() => setActive(null)} />;
  }

  return (
    <AppShell>
      <PageHeader
        title="Ferramentas"
        subtitle="Exercícios estruturados de TCC e regulação emocional para usar entre as consultas."
      />

      <div className="grid gap-4">
        {TOOL_LIST.map((def) => {
          const Icon = ICONS[def.icon];
          const last = history?.find((h) => h.tool_key === def.key);
          return (
            <div key={def.key} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <Icon className="size-6" />
                </span>
                <div className="flex-1">
                  <h3 className="font-semibold">{def.name}</h3>
                  <p className="text-sm text-muted-foreground">{def.description}</p>
                  {last && (
                    <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                      Último registro:{" "}
                      <span className="text-foreground">
                        {format(new Date(last.created_at), "d MMM yyyy", { locale: ptBR })}
                      </span>
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActive(def.key)}
                className="mt-4 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Novo registro · {def.short}
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
              const def = TOOLS[h.tool_key];
              if (!def) return null;
              return (
                <div
                  key={h.id}
                  className="rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{def.short}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(h.created_at), "d MMM yyyy, HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {def.summary(h.data)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}

type FieldValue = string | number | string[] | null;

function FillTool({ def, onDone }: { def: ToolDef; onDone: () => void }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, FieldValue>>(() => {
    const init: Record<string, FieldValue> = {};
    for (const f of def.fields) {
      if (f.type === "multiselect") init[f.key] = [];
      else if (f.type === "scale") init[f.key] = null;
      else init[f.key] = "";
    }
    return init;
  });

  const complete = useMemo(
    () =>
      def.fields.every((f) => {
        if (f.optional) return true;
        const v = values[f.key];
        if (f.type === "multiselect") return Array.isArray(v) && v.length > 0;
        if (f.type === "scale") return typeof v === "number";
        return typeof v === "string" && v.trim().length > 0;
      }),
    [def, values],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!complete) throw new Error("incomplete");
      const { data: u } = await supabase.auth.getUser();
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
        cleaned[k] = v;
      }
      const { error } = await supabase.from("tool_entries").insert({
        user_id: u.user!.id,
        tool_key: def.key,
        data: cleaned as Record<string, string | number | string[]>,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro salvo.");
      qc.invalidateQueries({ queryKey: ["tool-entries"] });
      onDone();
    },
    onError: (e) =>
      toast.error(
        e instanceof Error && e.message === "incomplete"
          ? "Preencha os campos obrigatórios."
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
        {def.fields.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
          />
        ))}
      </div>

      <div className="sticky bottom-20 mt-6 flex items-center justify-end rounded-2xl border border-border bg-card p-4 shadow-sm md:bottom-4">
        <button
          onClick={() => save.mutate()}
          disabled={!complete || save.isPending}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Check className="size-4" />
          {save.isPending ? "Salvando..." : "Salvar registro"}
        </button>
      </div>
    </AppShell>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ToolField;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <label className="mb-2 block text-sm font-medium">
        {field.label}
        {field.optional && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>
        )}
      </label>
      {field.help && <p className="mb-2 text-xs text-muted-foreground">{field.help}</p>}

      {field.type === "text" && (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
        />
      )}

      {field.type === "textarea" && (
        <textarea
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
        />
      )}

      {field.type === "scale" && (
        <div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: field.max - field.min + 1 }, (_, k) => field.min + k).map(
              (n) => {
                const selected = value === n;
                return (
                  <button
                    key={n}
                    onClick={() => onChange(n)}
                    className={cn(
                      "size-9 rounded-lg border text-sm font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:border-primary/40",
                    )}
                  >
                    {n}
                  </button>
                );
              },
            )}
          </div>
          {(field.minLabel || field.maxLabel) && (
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span>{field.minLabel}</span>
              <span>{field.maxLabel}</span>
            </div>
          )}
        </div>
      )}

      {field.type === "multiselect" && (
        <div className="flex flex-wrap gap-2">
          {field.options.map((opt) => {
            const arr = Array.isArray(value) ? value : [];
            const selected = arr.includes(opt);
            return (
              <button
                key={opt}
                onClick={() =>
                  onChange(
                    selected ? arr.filter((o) => o !== opt) : [...arr, opt],
                  )
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:border-primary/40",
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
