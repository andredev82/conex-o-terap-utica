import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Send, BookHeart, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/pacientes/$patientId")({
  component: PatientDetailPage,
  errorComponent: () => (
    <AppShell>
      <div className="py-20 text-center text-sm text-muted-foreground">
        Não foi possível carregar este paciente.
      </div>
    </AppShell>
  ),
});

type Message = {
  id: string;
  patient_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function PatientDetailPage() {
  const { patientId } = Route.useParams();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setTherapistId(data.user?.id ?? null));
  }, []);

  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", patientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: moods } = useQuery({
    queryKey: ["patient-moods", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("mood_entries")
        .select("id, mood, anxiety, energy, note, created_at")
        .eq("user_id", patientId)
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const { data: diary } = useQuery({
    queryKey: ["patient-diary", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("diary_entries")
        .select("id, title, situation, created_at")
        .eq("user_id", patientId)
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["thread", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`thread-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `patient_id=eq.${patientId}` },
        () => qc.invalidateQueries({ queryKey: ["thread", patientId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useMutation({
    mutationFn: async () => {
      const body = text.trim();
      if (!body || !therapistId) return;
      const { error } = await supabase
        .from("messages")
        .insert({ patient_id: patientId, sender_id: therapistId, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["thread", patientId] });
    },
    onError: () => toast.error("Não foi possível enviar."),
  });

  const name = patient?.full_name?.trim() || "Paciente";

  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/app/pacientes"
          className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">{name}</h1>
          <p className="text-xs text-muted-foreground">Acompanhamento e conversa</p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <HeartPulse className="size-4 text-primary" /> Emoções recentes
          </h2>
          {moods && moods.length > 0 ? (
            <ul className="space-y-2">
              {moods.map((m) => (
                <li key={m.id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Humor {m.mood} · Ansiedade {m.anxiety} · Energia {m.energy}
                  </span>
                  <span className="ml-1">
                    · {format(new Date(m.created_at), "d MMM", { locale: ptBR })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum check-in ainda.</p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <BookHeart className="size-4 text-primary" /> Diário recente
          </h2>
          {diary && diary.length > 0 ? (
            <ul className="space-y-2">
              {diary.map((d) => (
                <li key={d.id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {d.title?.trim() || d.situation?.slice(0, 40) || "Registro"}
                  </span>
                  <span className="ml-1">
                    · {format(new Date(d.created_at), "d MMM", { locale: ptBR })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum registro ainda.</p>
          )}
        </div>
      </div>

      <div className="flex h-[60vh] flex-col rounded-2xl border border-border bg-card">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages?.length === 0 && (
            <p className="mt-10 text-center text-sm text-muted-foreground">
              Nenhuma mensagem ainda. Envie a primeira para {name.split(" ")[0]}.
            </p>
          )}
          {messages?.map((m) => {
            const mine = m.sender_id === therapistId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-secondary text-secondary-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <time
                    className={cn(
                      "mt-1 block text-[10px]",
                      mine ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {format(new Date(m.created_at), "d MMM, HH:mm", { locale: ptBR })}
                  </time>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
          className="flex items-center gap-2 border-t border-border p-3"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva uma resposta..."
            className="flex-1 rounded-full border border-input bg-background px-4 py-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="submit"
            disabled={send.isPending || !text.trim()}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="size-5" />
          </button>
        </form>
      </div>
    </AppShell>
  );
}
