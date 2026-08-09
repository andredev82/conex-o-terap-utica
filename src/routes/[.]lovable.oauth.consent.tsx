import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Leaf } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type OAuthResult = {
  data?: {
    client?: { name?: string } | null;
    redirect_url?: string;
    redirect_to?: string;
  } | null;
  error?: { message: string } | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("authorization_id ausente");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/auth",
        search: { next: location.pathname + location.searchStr },
      });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <p className="max-w-md text-sm text-muted-foreground">
        Não foi possível carregar este pedido de autorização:{" "}
        {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "este aplicativo";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <span className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Leaf className="size-5" />
        </span>
        <h1 className="text-xl font-semibold">Conectar {clientName} à sua conta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Isso permite que {clientName} acesse seus registros do Sereno (humor, diário, testes e
          ferramentas) em seu nome. Você pode revogar o acesso a qualquer momento.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            Recusar
          </button>
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Autorizar
          </button>
        </div>
      </div>
    </main>
  );
}
