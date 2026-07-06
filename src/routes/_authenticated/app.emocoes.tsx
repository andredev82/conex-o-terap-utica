import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/emocoes")({
  component: MoodPage,
});

type Mood = {
  id: string;
  mood: number;
  anxiety: number;
  energy: number;
  note: string | null;
  created_at: string;
};

const SCALES = [
  { key: "mood" as const, label: "Humor", low: "Muito baixo", high: "Ótimo" },
  { key: "anxiety" as const, label: "Ansiedade", low: "Calmo", high: "Muito ansioso" },
  { key: "energy" as const, label: "Energia", low: "Exausto", high: "Cheio de energia" },
];

function MoodPage() {
  const qc = useQueryClient();
  const [values, setValues] = useState({ mood: 3, anxiety: 3, energy: 3 });
  const [note, setNote] = useState("");

  const { data: entries } = useQuery({
    queryKey: ["moods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mood_entries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as Mood[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("mood_entries").insert({
        user_id: u.user!.id,
        mood: values.mood,
        anxiety: values.anxiety,
        energy: values.energy,
        note: note.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Check-in registrado 💚");
      setNote("");
      setValues({ mood: 3, anxiety: 3, energy: 3 });
      qc.invalidateQueries({ queryKey: ["moods"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: () => toast.error("Não foi possível salvar."),
  });

  const chart = [...(entries ?? [])]
    .reverse()
    .map((e) => ({
      date: format(new Date(e.created_at), "d/MM"),
      Humor: e.mood,
      Ansiedade: e.anxiety,
      Energia: e.energy,
    }));

  return (
    <AppShell>
      <PageHeader
        title="Como você está?"
        subtitle="Um check-in simples ajuda você e seu terapeuta a acompanhar padrões."
      />

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="space-y-5">
          {SCALES.map((s) => (
            <div key={s.key}>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium">{s.label}</label>
                <span className="font-serif text-lg font-semibold text-primary">{values[s.key]}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={values[s.key]}
                onChange={(e) => setValues((v) => ({ ...v, [s.key]: Number(e.target.value) }))}
                className="w-full accent-[var(--primary)]"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>{s.low}</span>
                <span>{s.high}</span>
              </div>
            </div>
          ))}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Quer anotar algo? (opcional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {save.isPending ? "Salvando..." : "Registrar check-in"}
          </button>
        </div>
      </div>

      {chart.length > 1 && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold">Seus últimos registros</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="Humor" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Ansiedade" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Energia" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </AppShell>
  );
}
