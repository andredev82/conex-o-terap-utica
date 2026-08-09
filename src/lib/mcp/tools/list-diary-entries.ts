import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_diary_entries",
  title: "Listar registros do diário de TCC",
  description:
    "Lista os registros de pensamento (RPD) do diário de TCC do usuário autenticado, do mais recente para o mais antigo.",
  inputSchema: {
    limit: z.number().int().optional().describe("Quantidade máxima de registros (padrão 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 10, 1), 50);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("diary_entries")
      .select(
        "id, title, situation, automatic_thoughts, emotions, emotion_intensity, distortions, alternative_thought, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(take);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { entries: data ?? [] },
    };
  },
});
