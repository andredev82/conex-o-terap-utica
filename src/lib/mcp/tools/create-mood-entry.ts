import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_mood_entry",
  title: "Registrar check-in de humor",
  description:
    "Cria um check-in de humor para o usuário autenticado. Humor, ansiedade e energia vão de 1 a 10.",
  inputSchema: {
    mood: z.number().int().describe("Humor de 1 (muito baixo) a 10 (muito bom)."),
    anxiety: z.number().int().describe("Ansiedade de 1 (calmo) a 10 (muito ansioso)."),
    energy: z.number().int().describe("Energia de 1 (exausto) a 10 (cheio de energia)."),
    note: z.string().optional().describe("Nota livre sobre o momento."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ mood, anxiety, energy, note }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const clamp = (n: number) => Math.min(Math.max(Math.round(n), 1), 10);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("mood_entries")
      .insert({
        user_id: ctx.getUserId(),
        mood: clamp(mood),
        anxiety: clamp(anxiety),
        energy: clamp(energy),
        note: note?.trim() || null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { entry: data },
    };
  },
});
