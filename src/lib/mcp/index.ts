import { auth, defineMcp } from "@lovable.dev/mcp-js";
import createDiaryEntry from "./tools/create-diary-entry";
import createMoodEntry from "./tools/create-mood-entry";
import listAssessments from "./tools/list-assessments";
import listDiaryEntries from "./tools/list-diary-entries";
import listMoodEntries from "./tools/list-mood-entries";
import listToolEntries from "./tools/list-tool-entries";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "conexao-terapeutica",
  title: "Conexão Terapêutica",
  version: "0.1.0",
  instructions:
    "Ferramentas do Sereno, app de acompanhamento terapêutico entre consultas. Permite ler e registrar check-ins de humor, registros do diário de TCC, resultados de escalas psicométricas e registros de ferramentas estruturadas do usuário autenticado. Todos os dados são pessoais e sensíveis: trate com cuidado clínico e nunca compartilhe fora do contexto do usuário.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listMoodEntries,
    createMoodEntry,
    listDiaryEntries,
    createDiaryEntry,
    listAssessments,
    listToolEntries,
  ],
});
