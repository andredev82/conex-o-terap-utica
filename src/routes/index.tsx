import { createFileRoute, Link } from "@tanstack/react-router";
import { BookHeart, HeartPulse, MessageCircle, Leaf, ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  {
    icon: BookHeart,
    title: "Diário de TCC teste",
    desc: "Registre situações, pensamentos automáticos e reestruture-os com ferramentas da terapia cognitivo-comportamental.",
  },
  {
    icon: HeartPulse,
    title: "Check-ins de emoção",
    desc: "Acompanhe humor, ansiedade e energia ao longo do tempo e perceba seus padrões.",
  },
  {
    icon: MessageCircle,
    title: "Canal com o terapeuta",
    desc: "Comunicação direta e registrada, para o manejo entre uma consulta e outra.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Leaf className="size-5" />
          </span>
          <span className="font-serif text-xl font-semibold">Sereno</span>
        </div>
        <Link
          to="/auth"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Entrar
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-10 md:grid-cols-2 md:py-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            Cuidado contínuo entre as consultas
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-tight md:text-5xl">
            Um espaço acolhedor entre você e sua terapia
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            O Sereno acompanha você entre as sessões: um diário com ferramentas de TCC, o
            monitoramento das suas emoções e um canal direto com seu terapeuta.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Começar agora <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl border border-border shadow-sm">
          <img
            src={heroImg}
            alt="Paisagem serena com colinas suaves e um amanhecer, representando calma e bem-estar"
            width={1280}
            height={960}
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <f.icon className="size-6" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        Sereno — feito para apoiar o cuidado em saúde mental.
      </footer>
    </div>
  );
}
