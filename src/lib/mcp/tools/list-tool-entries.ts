import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tool_entries",
  title: "Listar registros de ferramentas",
  description:
    "Lista os registros das ferramentas estruturadas (RPD, gratidão, grounding e outras) do usuário autenticado.",
  inputSchema: {
    tool_key: z.string().optional().describe("Filtra por chave da ferramenta."),
    limit: z.number().int().optional().describe("Quantidade máxima de registros (padrão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tool_key, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("tool_entries")
      .select("id, tool_key, data, created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (tool_key) query = query.eq("tool_key", tool_key);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { entries: data ?? [] },
    };
  },
});
