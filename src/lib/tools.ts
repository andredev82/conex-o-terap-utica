// Motor genérico e reutilizável de ferramentas estruturadas.
// Cada ferramenta é um template declarativo de campos, salvo em `tool_entries`
// como { tool_key, data }. Isso permite escalar para outras especialidades
// (TO, fisioterapia, fonoaudiologia) apenas adicionando novos templates.

export type ToolField =
  | {
      key: string;
      type: "text";
      label: string;
      placeholder?: string;
      help?: string;
      optional?: boolean;
    }
  | {
      key: string;
      type: "textarea";
      label: string;
      placeholder?: string;
      help?: string;
      optional?: boolean;
    }
  | {
      key: string;
      type: "scale";
      label: string;
      help?: string;
      min: number;
      max: number;
      minLabel?: string;
      maxLabel?: string;
      optional?: boolean;
    }
  | {
      key: string;
      type: "multiselect";
      label: string;
      help?: string;
      options: string[];
      optional?: boolean;
    };

export type ToolDef = {
  key: string;
  name: string;
  short: string;
  description: string;
  intro: string;
  /** Nome do ícone lucide-react usado na lista. */
  icon: "Brain" | "Sparkles" | "Anchor" | "NotebookPen";
  fields: ToolField[];
  /** Resumo curto para exibir no histórico/painel do terapeuta. */
  summary: (data: Record<string, unknown>) => string;
};

const DISTORTIONS = [
  "Catastrofização",
  "Leitura mental",
  "Adivinhação",
  "Pensamento tudo-ou-nada",
  "Generalização excessiva",
  "Filtro mental / negativo",
  "Desqualificar o positivo",
  "Raciocínio emocional",
  "Rotulação",
  "Personalização",
  "Deveria / tenho que",
];

function firstText(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return typeof v === "string" ? v : "";
}

// RPD — Registro de Pensamentos Disfuncionais (Beck) — domínio de técnicas de TCC.
export const RPD: ToolDef = {
  key: "rpd",
  name: "Registro de Pensamentos",
  short: "RPD",
  description:
    "Ferramenta clássica da TCC para identificar e reestruturar pensamentos automáticos.",
  intro:
    "Registre uma situação recente e trabalhe o pensamento automático até uma resposta mais equilibrada.",
  icon: "Brain",
  fields: [
    {
      key: "situation",
      type: "textarea",
      label: "Situação",
      placeholder: "O que aconteceu? Onde, quando, com quem?",
    },
    {
      key: "emotion",
      type: "text",
      label: "Emoção principal",
      placeholder: "Ex.: ansiedade, tristeza, raiva",
    },
    {
      key: "intensity_before",
      type: "scale",
      label: "Intensidade da emoção (antes)",
      min: 0,
      max: 10,
      minLabel: "Leve",
      maxLabel: "Intensa",
    },
    {
      key: "automatic_thought",
      type: "textarea",
      label: "Pensamento automático",
      placeholder: "O que passou pela sua cabeça no momento?",
    },
    {
      key: "distortions",
      type: "multiselect",
      label: "Distorções cognitivas presentes",
      help: "Opcional — marque as que reconhecer.",
      options: DISTORTIONS,
      optional: true,
    },
    {
      key: "evidence_for",
      type: "textarea",
      label: "Evidências a favor do pensamento",
      placeholder: "Fatos que sustentam esse pensamento",
      optional: true,
    },
    {
      key: "evidence_against",
      type: "textarea",
      label: "Evidências contra o pensamento",
      placeholder: "Fatos que contradizem esse pensamento",
    },
    {
      key: "balanced_thought",
      type: "textarea",
      label: "Pensamento alternativo/equilibrado",
      placeholder: "Uma forma mais realista e útil de ver a situação",
    },
    {
      key: "intensity_after",
      type: "scale",
      label: "Intensidade da emoção (depois)",
      min: 0,
      max: 10,
      minLabel: "Leve",
      maxLabel: "Intensa",
    },
  ],
  summary: (d) => {
    const s = firstText(d, "situation");
    return s ? s.slice(0, 80) : firstText(d, "automatic_thought").slice(0, 80);
  },
};

// Diário de Gratidão — prática de psicologia positiva, de uso livre.
export const GRATITUDE: ToolDef = {
  key: "gratitude",
  name: "Diário de Gratidão",
  short: "Gratidão",
  description:
    "Registre pequenas coisas boas do dia para treinar o foco no positivo.",
  intro: "Anote três coisas pelas quais você é grato(a) hoje e uma breve reflexão.",
  icon: "Sparkles",
  fields: [
    { key: "item1", type: "text", label: "1. Sou grato(a) por…", placeholder: "Algo do seu dia" },
    { key: "item2", type: "text", label: "2. Sou grato(a) por…", placeholder: "Algo do seu dia" },
    { key: "item3", type: "text", label: "3. Sou grato(a) por…", placeholder: "Algo do seu dia" },
    {
      key: "reflection",
      type: "textarea",
      label: "Reflexão",
      placeholder: "Como você se sente ao reler esta lista?",
      optional: true,
    },
    {
      key: "mood",
      type: "scale",
      label: "Como está seu ânimo agora?",
      min: 0,
      max: 10,
      minLabel: "Baixo",
      maxLabel: "Ótimo",
    },
  ],
  summary: (d) =>
    [firstText(d, "item1"), firstText(d, "item2"), firstText(d, "item3")]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 90),
};

// Grounding 5-4-3-2-1 — técnica de aterramento sensorial, de uso livre.
export const GROUNDING: ToolDef = {
  key: "grounding",
  name: "Grounding 5-4-3-2-1",
  short: "Grounding",
  description:
    "Técnica de aterramento sensorial para momentos de ansiedade ou dissociação.",
  intro:
    "Use os sentidos para se reconectar com o presente. Preencha após fazer o exercício.",
  icon: "Anchor",
  fields: [
    {
      key: "calm_before",
      type: "scale",
      label: "Nível de tensão antes",
      min: 0,
      max: 10,
      minLabel: "Calmo",
      maxLabel: "Tenso",
    },
    { key: "see", type: "textarea", label: "5 coisas que você vê", placeholder: "..." },
    { key: "hear", type: "textarea", label: "4 coisas que você ouve", placeholder: "..." },
    { key: "touch", type: "textarea", label: "3 coisas que você sente ao tocar", placeholder: "..." },
    { key: "smell", type: "text", label: "2 coisas que você cheira", placeholder: "..." },
    { key: "taste", type: "text", label: "1 coisa que você saboreia", placeholder: "..." },
    {
      key: "calm_after",
      type: "scale",
      label: "Nível de tensão depois",
      min: 0,
      max: 10,
      minLabel: "Calmo",
      maxLabel: "Tenso",
    },
  ],
  summary: (d) => {
    const before = d.calm_before;
    const after = d.calm_after;
    if (typeof before === "number" && typeof after === "number") {
      return `Tensão ${before} → ${after}`;
    }
    return "Exercício de aterramento";
  },
};

export const TOOLS: Record<string, ToolDef> = {
  rpd: RPD,
  gratitude: GRATITUDE,
  grounding: GROUNDING,
};

export const TOOL_LIST: ToolDef[] = [RPD, GRATITUDE, GROUNDING];
