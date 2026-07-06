import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Turns the current signed-in user into a therapist (idempotent).
export const becomeTherapist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: context.userId, role: "therapist" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    if (error) throw error;
    return { ok: true };
  });

// Links a patient (found by e-mail) to the current therapist.
export const linkPatientByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ email: z.string().trim().email("E-mail inválido").max(255) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "therapist")) {
      throw new Error("Apenas terapeutas podem adicionar pacientes.");
    }

    const email = data.email.toLowerCase();
    let patientId: string | undefined;
    for (let page = 1; page <= 20 && !patientId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw error;
      const found = list.users.find((u) => u.email?.toLowerCase() === email);
      if (found) patientId = found.id;
      if (list.users.length < 200) break;
    }

    if (!patientId) throw new Error("Nenhum paciente encontrado com esse e-mail.");
    if (patientId === context.userId) {
      throw new Error("Você não pode adicionar a si mesmo como paciente.");
    }

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ therapist_id: context.userId })
      .eq("user_id", patientId);
    if (upErr) throw upErr;

    return { ok: true };
  });

// Removes the link between a patient and the current therapist.
export const unlinkPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ patientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ therapist_id: null })
      .eq("user_id", data.patientId)
      .eq("therapist_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
