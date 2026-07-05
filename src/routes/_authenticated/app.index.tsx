import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookHeart, HeartPulse, MessageCircle, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const [{ data: user }, moods, diary, msgs] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("mood_entries").select("id", { count: "exact", head: true }),
        supabase.from("diary_entries").select("id", { count: "exact", head: true }),
        supabase.from("messages").select("id", { count: "exact", head: true }),
      ]);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.user!.id)
        .maybeSingle();
      return {
        name: profile?.full_name?.split(" ")[0] ?? "",
        moods: moods.count ?? 0,
        diary: diary.count ?? 0,
        msgs: msgs.count ?? 0,
      };
    },
  });

  const cards = [
    {
      to: "/app/emocoes",
      icon: HeartPulse,
      title: "Como você está agora?",
      desc: "Faça um check-in rápido das suas emoções.",
      cta: "Registrar emoção",
    },
    {
      to: "/app/diario",
      icon: BookHeart,
      title: "Diário de TCC",
      desc: "Escreva sobre uma situação e reestruture pensamentos.",
      cta: "Abrir diário",
    },
    {
      to: "/app/mensagens",
      icon: MessageCircle,
      title: "Fale com seu terapeuta",
      desc: "Compartilhe algo importante entre as consultas.",
      cta: "Ver conversa",
    },
  ] as const;

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold md:text-3xl">
          {greeting()}
          {data?.name ? `, ${data.name}` : ""} 🌿
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Que bom te ver por aqui. Um passo de cada vez.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Check-ins" value={data?.moods ?? 0} />
        <Stat label="Registros" value={data?.diary ?? 0} />
        <Stat label="Mensagens" value={data?.msgs ?? 0} />
      </div>

      <div className="grid gap-4">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <c.icon className="size-6" />
            </span>
            <div className="flex-1">
              <h3 className="font-semibold">{c.title}</h3>
              <p className="text-sm text-muted-foreground">{c.desc}</p>
            </div>
            <span className="flex items-center gap-1 text-sm font-medium text-primary">
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <div className="font-serif text-2xl font-semibold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
