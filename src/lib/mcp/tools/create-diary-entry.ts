import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_diary_entry",
  title: "Criar registro no diário de TCC",
  description:
    "Cria um registro de pensamento (RPD) no diário de TCC do usuário autenticado, com situação, pensamentos automáticos, emoções e pensamento alternativo.",
  inputSchema: {
    title: z.string().optional().describe("Título curto do registro."),
    situation: z.string().describe("O que aconteceu (situação objetiva)."),
    automatic_thoughts: z.string().optional().describe("Pensamentos automáticos surgidos."),
    emotions: z.string().optional().describe("Emoções sentidas."),
    emotion_intensity: z
      .number()
      .int()
      .optional()
      .describe("Intensidade da emoção de 0 a 100."),
    distortions: z
      .array(z.string())
      .optional()
      .describe("Distorções cognitivas identificadas."),
    alternative_thought: z.string().optional().describe("Pensamento alternativo mais equilibrado."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const intensity =
      typeof input.emotion_intensity === "number"
        ? Math.min(Math.max(Math.round(input.emotion_intensity), 0), 100)
        : null;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("diary_entries")
      .insert({
        user_id: ctx.getUserId(),
        title: input.title?.trim() || null,
        situation: input.situation,
        automatic_thoughts: input.automatic_thoughts ?? null,
        emotions: input.emotions ?? null,
        emotion_intensity: intensity,
        distortions: input.distortions ?? null,
        alternative_thought: input.alternative_thought ?? null,
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
