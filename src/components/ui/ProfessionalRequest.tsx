import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

type Category = "psicologo" | "psiquiatra" | "psicanalista" | "terapeuta_holistico" | "outro";

const CATEGORIES: { value: Category; label: string; hint: string }[] = [
  { value: "psicologo", label: "Psicólogo(a)", hint: "Exige registro ativo no CRP." },
  { value: "psiquiatra", label: "Psiquiatra", hint: "Exige registro ativo no CRM." },
  {
    value: "psicanalista",
    label: "Psicanalista",
    hint: "Informe sua formação e o instituto ou associação a que pertence.",
  },
  {
    value: "terapeuta_holistico",
    label: "Terapeuta holístico / integrativo",
    hint: "Informe sua formação, certificações e a instituição ou associação.",
  },
  { value: "outro", label: "Outro profissional", hint: "Descreva sua formação e atuação." },
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const inputClass =
  "w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

export function ProfessionalRequest() {
  const qc = useQueryClient();
  const [category, setCategory] = useState<Category | "">("");
  const [registration, setRegistration] = useState("");
  const [uf, setUf] = useState("");
  const [proof, setProof] = useState("");

  const hasCouncil = category === "psicologo" || category === "psiquiatra";
  const selected = CATEGORIES.find((c) => c.value === category);

  const { data: verification, isLoading } = useQuery({
    queryKey: ["my-verification"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("therapist_verifications")
        .select("status")
        .eq("user_id", u.user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const request = useMutation({
    mutationFn: async () => {
      if (!category) throw new Error("Selecione sua categoria profissional.");
      const reg = registration.trim();
      const note = proof.trim();

      let payload: Record<string, unknown>;
      if (category === "psicologo" || category === "psiquiatra") {
        if (!reg || !uf) throw new Error("Informe o número do registro e a UF.");
        payload = {
          category,
          council: category === "psicologo" ? "CRP" : "CRM",
          registration_number: reg,
          uf,
          proof_note: note || null,
        };
      } else {
        if (note.length < 20) {
          throw new Error("Descreva sua formação e atuação (mínimo de 20 caracteres).");
        }
        payload = {
          category,
          council: reg ? "outro" : null,
          registration_number: reg || null,
          uf: uf || null,
          proof_note: note,
        };
      }

      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("therapist_verifications")
        .insert({ user_id: u.user!.id, ...payload } as never);
      if (error) throw new Error("Não foi possível enviar a solicitação.");
    },
    onSuccess: () => {
      toast.success("Solicitação enviada.");
      qc.invalidateQueries({ queryKey: ["my-verification"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível enviar."),
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="py-20 text-center text-sm text-muted-foreground">Carregando...</div>
      </AppShell>
    );
  }

  const status = verification?.status;

  return (
    <AppShell>
      <PageHeader
        title="Painel do profissional"
        subtitle="Acompanhe seus pacientes entre as consultas."
      />

      {status === "pending" && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
            <Clock className="size-7" />
          </span>
          <h2 className="text-lg font-semibold">Solicitação em análise</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Recebemos seus dados profissionais. Assim que forem conferidos, o painel será liberado
            nesta tela.
          </p>
        </div>
      )}

      {status === "rejected" && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold">Solicitação não aprovada</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Sua solicitação não foi aprovada. Entre em contato com o suporte para mais informações.
          </p>
        </div>
      )}

      {status === "approved" && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold">Acesso aprovado</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Seu acesso foi aprovado. Atualize a página para ver o painel.
          </p>
        </div>
      )}

      {!status && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate();
          }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="mb-4 text-center">
            <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
              <Sparkles className="size-7" />
            </span>
            <h2 className="text-lg font-semibold">Cadastro profissional</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Para vincular pacientes e acompanhar a evolução deles, precisamos conferir sua
              formação. O que você poderá ver e configurar depende da categoria aprovada.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium">
                Categoria profissional
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category | "")}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              {selected && <p className="mt-1.5 text-xs text-muted-foreground">{selected.hint}</p>}
            </div>

            {category && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label htmlFor="registration" className="mb-1.5 block text-sm font-medium">
                      {category === "psicologo"
                        ? "Número do CRP"
                        : category === "psiquiatra"
                          ? "Número do CRM"
                          : "Registro em associação (opcional)"}
                    </label>
                    <input
                      id="registration"
                      value={registration}
                      onChange={(e) => setRegistration(e.target.value)}
                      maxLength={30}
                      placeholder={hasCouncil ? "Ex: 06/12345" : "Se houver"}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="uf" className="mb-1.5 block text-sm font-medium">
                      UF{hasCouncil ? "" : " (opc.)"}
                    </label>
                    <select
                      id="uf"
                      value={uf}
                      onChange={(e) => setUf(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">--</option>
                      {UFS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="proof" className="mb-1.5 block text-sm font-medium">
                    {hasCouncil ? "Observações (opcional)" : "Formação e vínculo profissional"}
                  </label>
                  <textarea
                    id="proof"
                    value={proof}
                    onChange={(e) => setProof(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder={
                      hasCouncil
                        ? "Algo que ajude na conferência do seu registro"
                        : "Ex: formação em psicanálise pelo Instituto X (2019), membro da Associação Y, certificação Z..."
                    }
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  disabled={request.isPending}
                  className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {request.isPending ? "Enviando..." : "Enviar solicitação"}
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </AppShell>
  );
}
