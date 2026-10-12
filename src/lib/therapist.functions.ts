import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GENERIC_INVITE_MSG = "Se existir uma conta com esse e-mail, o convite foi enviado.";

async function assertRole(
  supabase: { rpc: (fn: "has_role", a: { _user_id: string; _role: "admin" | "therapist" }) => PromiseLike<{ data: boolean | null }> },
  userId: string,
  role: "admin" | "therapist",
) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: role });
  if (!data) throw new Error("Acesso não autorizado.");
}

// Therapist invites a patient by e-mail. Always returns the same generic message.
export const invitePatientByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ email: z.string().trim().email("E-mail inválido").max(255) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase as never, context.userId, "therapist");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("therapist_links")
      .select("id", { count: "exact", head: true })
      .eq("therapist_id", context.userId)
      .eq("status", "pending");
    if ((count ?? 0) >= 20) {
      throw new Error("Você atingiu o limite de 20 convites pendentes.");
    }

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("email", data.email.toLowerCase())
      .maybeSingle();

    if (prof && prof.user_id !== context.userId) {
      // Does not overwrite existing links (any status).
      await supabaseAdmin
        .from("therapist_links")
        .upsert(
          { therapist_id: context.userId, patient_id: prof.user_id, status: "pending" },
          { onConflict: "therapist_id,patient_id", ignoreDuplicates: true },
        );
    }
    return { message: GENERIC_INVITE_MSG };
  });

// Therapist ends the link (marks as revoked).
export const unlinkPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ patientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("therapist_links")
      .update({ status: "revoked" })
      .eq("patient_id", data.patientId)
      .eq("therapist_id", context.userId);
    if (error) throw new Error("Não foi possível encerrar o vínculo.");
    return { ok: true };
  });

// Linha da tabela therapist_verifications com as colunas novas (categoria e comprovação).
type VerificationRow = {
  id: string;
  user_id: string;
  council: string | null;
  registration_number: string | null;
  uf: string | null;
  category: string;
  proof_note: string | null;
  created_at: string;
};

// Admin: list pending professional verifications.
export const listPendingVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.supabase as never, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("therapist_verifications")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error("Não foi possível carregar as solicitações.");

    const rows = (data ?? []) as unknown as VerificationRow[];
    const ids = rows.map((r) => r.user_id);
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("user_id, full_name, email").in("user_id", ids)
      : { data: [] as { user_id: string; full_name: string | null; email: string | null }[] };

    return rows.map((r) => {
      const p = profs?.find((x) => x.user_id === r.user_id);
      return {
        id: r.id,
        user_id: r.user_id,
        council: r.council,
        registration_number: r.registration_number,
        uf: r.uf,
        category: r.category,
        proof_note: r.proof_note,
        created_at: r.created_at,
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
      };
    });
  });

// Admin: approve or reject. Only approval grants the therapist role.
export const reviewVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["approved", "rejected"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase as never, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("therapist_verifications")
      .update({ status: data.decision, reviewed_at: new Date().toISOString(), reviewed_by: context.userId })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("user_id")
      .maybeSingle();
    if (error || !row) throw new Error("Solicitação não encontrada ou já analisada.");
    if (data.decision === "approved") {
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: row.user_id, role: "therapist" }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (rErr) throw new Error("Não foi possível conceder o acesso.");
    }
    return { ok: true };
  });
