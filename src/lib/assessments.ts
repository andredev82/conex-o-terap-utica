export type AssessmentType = "gad7" | "phq9";

export const RESPONSE_OPTIONS = [
  { value: 0, label: "Nenhum dia" },
  { value: 1, label: "Vários dias" },
  { value: 2, label: "Mais da metade dos dias" },
  { value: 3, label: "Quase todos os dias" },
] as const;

type Severity = { label: string; tone: "calm" | "mild" | "moderate" | "high" | "severe" };

export type AssessmentDef = {
  type: AssessmentType;
  name: string;
  short: string;
  description: string;
  intro: string;
  questions: string[];
  maxScore: number;
  severity: (score: number) => Severity;
};

const FREQ_INTRO =
  "Nas últimas 2 semanas, com que frequência você foi incomodado(a) pelos seguintes problemas?";

export const GAD7: AssessmentDef = {
  type: "gad7",
  name: "GAD-7 · Ansiedade",
  short: "GAD-7",
  description: "Escala de rastreio para transtorno de ansiedade generalizada.",
  intro: FREQ_INTRO,
  maxScore: 21,
  questions: [
    "Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)",
    "Não conseguir parar ou controlar as preocupações",
    "Preocupar-se muito com diversas coisas",
    "Dificuldade para relaxar",
    "Ficar tão agitado(a) que se torna difícil permanecer parado(a)",
    "Ficar facilmente aborrecido(a) ou irritado(a)",
    "Sentir medo como se algo terrível fosse acontecer",
  ],
  severity: (s) => {
    if (s <= 4) return { label: "Mínima", tone: "calm" };
    if (s <= 9) return { label: "Leve", tone: "mild" };
    if (s <= 14) return { label: "Moderada", tone: "moderate" };
    return { label: "Grave", tone: "severe" };
  },
};

export const PHQ9: AssessmentDef = {
  type: "phq9",
  name: "PHQ-9 · Depressão",
  short: "PHQ-9",
  description: "Questionário para rastreio e monitoramento de sintomas depressivos.",
  intro: FREQ_INTRO,
  maxScore: 27,
  questions: [
    "Pouco interesse ou pouco prazer em fazer as coisas",
    "Sentir-se para baixo, deprimido(a) ou sem perspectiva",
    "Dificuldade para pegar no sono, permanecer dormindo ou dormir demais",
    "Sentir-se cansado(a) ou com pouca energia",
    "Falta de apetite ou comer demais",
    "Sentir-se mal consigo mesmo(a) — ou achar que é um fracasso ou que decepcionou a si ou a família",
    "Dificuldade de concentração nas coisas (ler, ver televisão)",
    "Lentidão para se movimentar ou falar, ou o contrário — estar tão agitado(a) que anda de um lado para o outro mais do que o habitual",
    "Pensar em se ferir de alguma maneira ou que seria melhor estar morto(a)",
  ],
  severity: (s) => {
    if (s <= 4) return { label: "Mínima", tone: "calm" };
    if (s <= 9) return { label: "Leve", tone: "mild" };
    if (s <= 14) return { label: "Moderada", tone: "moderate" };
    if (s <= 19) return { label: "Moderadamente grave", tone: "high" };
    return { label: "Grave", tone: "severe" };
  },
};

export const ASSESSMENTS: Record<AssessmentType, AssessmentDef> = {
  gad7: GAD7,
  phq9: PHQ9,
};

export const severityToneClass: Record<Severity["tone"], string> = {
  calm: "bg-primary/15 text-primary",
  mild: "bg-secondary text-secondary-foreground",
  moderate: "bg-accent text-accent-foreground",
  high: "bg-destructive/15 text-destructive",
  severe: "bg-destructive/20 text-destructive",
};
