import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_assessments",
  title: "Listar resultados de testes",
  description:
    "Lista os resultados de escalas aplicadas (GAD-7, PHQ-9, DASS-21, WHO-5, PSS-10, AUDIT-C) do usuário autenticado, com pontuação e severidade.",
  inputSchema: {
    type: z
      .string()
      .optional()
      .describe("Filtra por tipo de escala, por exemplo gad7, phq9 ou dass21."),
    limit: z.number().int().optional().describe("Quantidade máxima de resultados (padrão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ type, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("assessments")
      .select("id, type, score, severity, created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (type) query = query.eq("type", type);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { assessments: data ?? [] },
    };
  },
});
