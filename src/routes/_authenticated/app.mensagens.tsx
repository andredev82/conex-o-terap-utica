import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/mensagens")({
  component: MessagesPage,
});

type Message = {
  id: string;
  patient_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function MessagesPage() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: messages } = useQuery({
    queryKey: ["messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["messages"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useMutation({
    mutationFn: async () => {
      const body = text.trim();
      if (!body || !userId) return;
      const { error } = await supabase
        .from("messages")
        .insert({ patient_id: userId, sender_id: userId, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: () => toast.error("Não foi possível enviar."),
  });

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-8rem)] flex-col md:h-[calc(100vh-6rem)]">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold md:text-3xl">Mensagens</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este é o seu canal com seu terapeuta. Tudo aqui fica registrado com segurança.
          </p>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-4">
          {messages?.length === 0 && (
            <p className="mt-10 text-center text-sm text-muted-foreground">
              Nenhuma mensagem ainda. Escreva algo que gostaria de compartilhar.
            </p>
          )}
          {messages?.map((m) => {
            const mine = m.sender_id === userId;
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
                  <time className={cn("mt-1 block text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
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
          className="mt-3 flex items-center gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva uma mensagem..."
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
