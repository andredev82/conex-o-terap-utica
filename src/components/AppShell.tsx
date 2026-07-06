import { Link, useRouterState } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookHeart, HeartPulse, MessageCircle, LayoutDashboard, LogOut, User, Leaf, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsTherapist } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const baseNav = [
  { to: "/app", label: "Início", icon: LayoutDashboard },
  { to: "/app/diario", label: "Diário", icon: BookHeart },
  { to: "/app/emocoes", label: "Emoções", icon: HeartPulse },
  { to: "/app/mensagens", label: "Mensagens", icon: MessageCircle },
  { to: "/app/perfil", label: "Perfil", icon: User },
] as const;

const therapistTab = { to: "/app/pacientes", label: "Pacientes", icon: Users } as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: isTherapist } = useIsTherapist();
  const nav = isTherapist
    ? [...baseNav.slice(0, 4), therapistTab, baseNav[4]]
    : baseNav;

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
        <Link to="/app" className="mb-8 flex items-center gap-2 px-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Leaf className="size-5" />
          </span>
          <span className="font-serif text-xl font-semibold text-sidebar-foreground">Sereno</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleSignOut}
          className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-5" />
          Sair
        </button>
      </aside>

      {/* Content */}
      <div className="flex-1 pb-24 md:pb-0">
        <main className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur md:hidden">
        {nav.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
