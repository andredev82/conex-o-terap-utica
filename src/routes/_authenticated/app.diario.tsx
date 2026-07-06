import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/diario")({
  component: DiaryPage,
});

const DISTORTIONS = [
  "Catastrofização",
  "Pensamento tudo-ou-nada",
  "Leitura mental",
  "Adivinhação",
  "Generalização",
  "Rotulação",
  "Filtro mental",
  "Culpa/personalização",
];

type Entry = {
  id: string;
  title: string | null;
  situation: string | null;
  automatic_thoughts: string | null;
  emotions: string | null;
  emotion_intensity: number | null;
  distortions: string[] | null;
  alternative_thought: string | null;
  created_at: string;
};

function DiaryPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: entries } = useQuery({
    queryKey: ["diary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diary_entries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Entry[];
    },
  });

  return (
    <AppShell>
      <div className="mb-4 flex items-start justify-between gap-4">
        <PageHeader
          title="Diário de TCC"
          subtitle="Registre uma situação e trabalhe seus pensamentos com calma."
        />
        <button
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" /> Novo
        </button>
      </div>

      {open && <DiaryForm onClose={() => setOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["diary"] })} />}

      <div className="space-y-4">
        {entries?.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Seu diário está vazio. Que tal começar com o primeiro registro?
          </p>
        )}
        {entries?.map((e) => (
          <article key={e.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{e.title || "Registro"}</h3>
              <time className="text-xs text-muted-foreground">
                {format(new Date(e.created_at), "d 'de' MMM, HH:mm", { locale: ptBR })}
              </time>
            </div>
            {e.situation && <Field label="Situação" value={e.situation} />}
            {e.automatic_thoughts && <Field label="Pensamentos automáticos" value={e.automatic_thoughts} />}
            {e.emotions && (
              <Field
                label="Emoções"
                value={`${e.emotions}${e.emotion_intensity ? ` (${e.emotion_intensity}/10)` : ""}`}
              />
            )}
            {e.distortions && e.distortions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {e.distortions.map((d) => (
                  <span key={d} className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                    {d}
                  </span>
                ))}
              </div>
            )}
            {e.alternative_thought && <Field label="Pensamento alternativo" value={e.alternative_thought} />}
          </article>
        ))}
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

function DiaryForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [situation, setSituation] = useState("");
  const [thoughts, setThoughts] = useState("");
  const [emotions, setEmotions] = useState("");
  const [intensity, setIntensity] = useState(5);
  const [distortions, setDistortions] = useState<string[]>([]);
  const [alternative, setAlternative] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("diary_entries").insert({
        user_id: u.user!.id,
        title: title.trim() || null,
        situation: situation.trim() || null,
        automatic_thoughts: thoughts.trim() || null,
        emotions: emotions.trim() || null,
        emotion_intensity: intensity,
        distortions,
        alternative_thought: alternative.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro salvo.");
      onSaved();
      onClose();
    },
    onError: () => toast.error("Não foi possível salvar."),
  });

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Novo registro</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="size-5" />
        </button>
      </div>
      <div className="space-y-4">
        <Input label="Título (opcional)" value={title} onChange={setTitle} placeholder="Ex: Reunião de trabalho" />
        <Textarea label="Situação — o que aconteceu?" value={situation} onChange={setSituation} />
        <Textarea label="Pensamentos automáticos — o que passou pela sua cabeça?" value={thoughts} onChange={setThoughts} />
        <Input label="Emoções sentidas" value={emotions} onChange={setEmotions} placeholder="Ex: ansiedade, tristeza" />
        <div>
          <label className="mb-1.5 block text-sm font-medium">Intensidade da emoção: {intensity}/10</label>
          <input
            type="range"
            min={0}
            max={10}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Distorções cognitivas</label>
          <div className="flex flex-wrap gap-2">
            {DISTORTIONS.map((d) => {
              const on = distortions.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setDistortions((prev) => (on ? prev.filter((x) => x !== d) : [...prev, d]))
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-accent",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <Textarea
          label="Pensamento alternativo — uma visão mais equilibrada"
          value={alternative}
          onChange={setAlternative}
        />
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {save.isPending ? "Salvando..." : "Salvar registro"}
        </button>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
    </div>
  );
}
