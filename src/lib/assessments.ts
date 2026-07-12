export type AssessmentType =
  | "gad7"
  | "phq9"
  | "dass21"
  | "who5"
  | "pss10"
  | "auditc";

export type ResponseOption = { value: number; label: string };

export const RESPONSE_OPTIONS: readonly ResponseOption[] = [
  { value: 0, label: "Nenhum dia" },
  { value: 1, label: "Vários dias" },
  { value: 2, label: "Mais da metade dos dias" },
  { value: 3, label: "Quase todos os dias" },
] as const;

// DASS-21 usa referência à última semana, com escala própria.
export const DASS_RESPONSE_OPTIONS: readonly ResponseOption[] = [
  { value: 0, label: "Não se aplicou de forma alguma" },
  { value: 1, label: "Aplicou-se em algum grau, ou por pouco tempo" },
  { value: 2, label: "Aplicou-se em grau considerável, ou boa parte do tempo" },
  { value: 3, label: "Aplicou-se muito, ou na maior parte do tempo" },
] as const;

type Tone = "calm" | "mild" | "moderate" | "high" | "severe";
type Severity = { label: string; tone: Tone };

export type SubscaleDef = {
  key: string;
  name: string;
  short: string;
  indices: number[]; // 0-based indices em questions
  multiplier?: number; // DASS-21 multiplica por 2
  severity: (score: number) => Severity;
};

export type AssessmentDef = {
  type: AssessmentType;
  name: string;
  short: string;
  description: string;
  intro: string;
  questions: string[];
  maxScore: number;
  responseOptions?: readonly ResponseOption[];
  // Opções distintas por pergunta (ex.: AUDIT-C). Tem prioridade sobre responseOptions.
  optionsPerQuestion?: readonly (readonly ResponseOption[])[];
  // Índices (0-based) de itens com pontuação invertida (ex.: PSS-10).
  reverseIndices?: number[];
  // Maior pontuação = melhor (ex.: WHO-5) — inverte o tom das cores.
  higherIsBetter?: boolean;
  // Formata a pontuação para exibição (ex.: WHO-5 em %).
  displayScore?: (score: number) => string;
  subscales?: SubscaleDef[];
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

// DASS-21 (Lovibond & Lovibond, 1995) — instrumento de uso livre.
// Cada subescala tem 7 itens; a pontuação bruta é multiplicada por 2.
const dassDepression = (s: number): Severity => {
  if (s <= 9) return { label: "Normal", tone: "calm" };
  if (s <= 13) return { label: "Leve", tone: "mild" };
  if (s <= 20) return { label: "Moderada", tone: "moderate" };
  if (s <= 27) return { label: "Grave", tone: "high" };
  return { label: "Extremamente grave", tone: "severe" };
};
const dassAnxiety = (s: number): Severity => {
  if (s <= 7) return { label: "Normal", tone: "calm" };
  if (s <= 9) return { label: "Leve", tone: "mild" };
  if (s <= 14) return { label: "Moderada", tone: "moderate" };
  if (s <= 19) return { label: "Grave", tone: "high" };
  return { label: "Extremamente grave", tone: "severe" };
};
const dassStress = (s: number): Severity => {
  if (s <= 14) return { label: "Normal", tone: "calm" };
  if (s <= 18) return { label: "Leve", tone: "mild" };
  if (s <= 25) return { label: "Moderada", tone: "moderate" };
  if (s <= 33) return { label: "Grave", tone: "high" };
  return { label: "Extremamente grave", tone: "severe" };
};

export const DASS21: AssessmentDef = {
  type: "dass21",
  name: "DASS-21 · Depressão, Ansiedade e Estresse",
  short: "DASS-21",
  description:
    "Escala com três subescalas para depressão, ansiedade e estresse (uso livre).",
  intro:
    "Leia cada afirmação e indique o quanto ela se aplicou a você durante a última semana. Não há respostas certas ou erradas.",
  maxScore: 63,
  responseOptions: DASS_RESPONSE_OPTIONS,
  questions: [
    "Achei difícil me acalmar",
    "Senti minha boca seca",
    "Não consegui vivenciar nenhum sentimento positivo",
    "Tive dificuldade em respirar em alguns momentos (ex.: respiração ofegante ou falta de ar, sem ter feito esforço físico)",
    "Achei difícil ter iniciativa para fazer as coisas",
    "Tive a tendência de reagir de forma exagerada às situações",
    "Senti tremores (ex.: nas mãos)",
    "Senti que estava sempre nervoso(a)",
    "Preocupei-me com situações em que eu pudesse entrar em pânico e parecer ridículo(a)",
    "Senti que não tinha nada a desejar ou esperar da vida",
    "Senti-me agitado(a)",
    "Achei difícil relaxar",
    "Senti-me deprimido(a) e sem ânimo",
    "Fui intolerante com as coisas que me impediam de continuar o que eu estava fazendo",
    "Senti que ia entrar em pânico",
    "Não consegui me entusiasmar com nada",
    "Senti que eu não tinha valor como pessoa",
    "Senti que estava um pouco emotivo(a) ou sensível demais",
    "Senti alterações no meu coração sem ter feito esforço físico (ex.: batimento acelerado ou perda de batimento)",
    "Senti medo sem motivo",
    "Senti que a vida não tinha sentido",
  ],
  subscales: [
    {
      key: "d",
      name: "Depressão",
      short: "D",
      // itens 3,5,10,13,16,17,21 (1-based)
      indices: [2, 4, 9, 12, 15, 16, 20],
      multiplier: 2,
      severity: dassDepression,
    },
    {
      key: "a",
      name: "Ansiedade",
      short: "A",
      // itens 2,4,7,9,15,19,20 (1-based)
      indices: [1, 3, 6, 8, 14, 18, 19],
      multiplier: 2,
      severity: dassAnxiety,
    },
    {
      key: "s",
      name: "Estresse",
      short: "E",
      // itens 1,6,8,11,12,14,18 (1-based)
      indices: [0, 5, 7, 10, 11, 13, 17],
      multiplier: 2,
      severity: dassStress,
    },
  ],
  severity: (s) => {
    // Tom aproximado com base na pontuação total (as subescalas dão o quadro real).
    if (s <= 12) return { label: "Normal", tone: "calm" };
    if (s <= 24) return { label: "Leve", tone: "mild" };
    if (s <= 36) return { label: "Moderada", tone: "moderate" };
    if (s <= 48) return { label: "Grave", tone: "high" };
    return { label: "Extremamente grave", tone: "severe" };
  },
};

// WHO-5 (Índice de Bem-Estar da OMS) — uso livre, maior pontuação = melhor.
export const WHO5_OPTIONS: readonly ResponseOption[] = [
  { value: 0, label: "Em nenhum momento" },
  { value: 1, label: "Alguns momentos" },
  { value: 2, label: "Menos da metade do tempo" },
  { value: 3, label: "Mais da metade do tempo" },
  { value: 4, label: "A maior parte do tempo" },
  { value: 5, label: "O tempo todo" },
] as const;

export const WHO5: AssessmentDef = {
  type: "who5",
  name: "WHO-5 · Bem-estar",
  short: "WHO-5",
  description: "Índice de bem-estar da OMS (uso livre). Maior pontuação = melhor.",
  intro:
    "Nas últimas 2 semanas, indique como você tem se sentido. Não há respostas certas ou erradas.",
  maxScore: 25,
  responseOptions: WHO5_OPTIONS,
  higherIsBetter: true,
  displayScore: (s) => `${s * 4}%`,
  questions: [
    "Senti-me alegre e de bom humor",
    "Senti-me calmo(a) e relaxado(a)",
    "Senti-me ativo(a) e cheio(a) de energia",
    "Acordei sentindo-me revigorado(a) e descansado(a)",
    "Meu dia a dia esteve cheio de coisas que me interessam",
  ],
  severity: (s) => {
    // Pontuação bruta 0–25 (bem-estar = raw×4 em %).
    if (s <= 6) return { label: "Muito baixo", tone: "severe" };
    if (s <= 12) return { label: "Baixo", tone: "high" };
    if (s <= 17) return { label: "Moderado", tone: "moderate" };
    if (s <= 21) return { label: "Bom", tone: "mild" };
    return { label: "Ótimo", tone: "calm" };
  },
};

// PSS-10 (Escala de Estresse Percebido, Cohen) — uso livre. Itens 4,5,7,8 invertidos.
export const PSS_OPTIONS: readonly ResponseOption[] = [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Quase nunca" },
  { value: 2, label: "Às vezes" },
  { value: 3, label: "Com frequência" },
  { value: 4, label: "Muito frequentemente" },
] as const;

export const PSS10: AssessmentDef = {
  type: "pss10",
  name: "PSS-10 · Estresse percebido",
  short: "PSS-10",
  description: "Escala de estresse percebido no último mês (uso livre).",
  intro:
    "No último mês, com que frequência você se sentiu ou pensou de determinada maneira?",
  maxScore: 40,
  responseOptions: PSS_OPTIONS,
  reverseIndices: [3, 4, 6, 7], // itens 4,5,7,8 (1-based)
  questions: [
    "Ficou aborrecido(a) por causa de algo que aconteceu inesperadamente",
    "Sentiu que não conseguia controlar as coisas importantes da sua vida",
    "Sentiu-se nervoso(a) e estressado(a)",
    "Sentiu confiança na sua capacidade de lidar com seus problemas pessoais",
    "Sentiu que as coisas estavam acontecendo conforme o esperado",
    "Percebeu que não conseguia lidar com todas as coisas que tinha para fazer",
    "Conseguiu controlar as irritações na sua vida",
    "Sentiu que estava no controle das coisas",
    "Ficou irritado(a) por coisas que estavam fora do seu controle",
    "Sentiu que as dificuldades se acumulavam a ponto de não conseguir superá-las",
  ],
  severity: (s) => {
    if (s <= 13) return { label: "Baixo", tone: "calm" };
    if (s <= 26) return { label: "Moderado", tone: "moderate" };
    return { label: "Alto", tone: "severe" };
  },
};

// AUDIT-C (rastreio de uso de álcool, OMS) — uso livre. Opções distintas por item.
export const AUDITC: AssessmentDef = {
  type: "auditc",
  name: "AUDIT-C · Uso de álcool",
  short: "AUDIT-C",
  description: "Rastreio breve de padrão de consumo de álcool (uso livre).",
  intro: "Responda pensando no seu consumo de bebidas alcoólicas.",
  maxScore: 12,
  optionsPerQuestion: [
    [
      { value: 0, label: "Nunca" },
      { value: 1, label: "1x/mês ou menos" },
      { value: 2, label: "2 a 4x/mês" },
      { value: 3, label: "2 a 3x/semana" },
      { value: 4, label: "4x ou mais/semana" },
    ],
    [
      { value: 0, label: "1 ou 2" },
      { value: 1, label: "3 ou 4" },
      { value: 2, label: "5 ou 6" },
      { value: 3, label: "7 a 9" },
      { value: 4, label: "10 ou mais" },
    ],
    [
      { value: 0, label: "Nunca" },
      { value: 1, label: "Menos de 1x/mês" },
      { value: 2, label: "Mensalmente" },
      { value: 3, label: "Semanalmente" },
      { value: 4, label: "Diariamente ou quase" },
    ],
  ],
  questions: [
    "Com que frequência você consome bebidas alcoólicas?",
    "Nos dias em que bebe, quantas doses costuma consumir?",
    "Com que frequência você consome 6 ou mais doses em uma única ocasião?",
  ],
  severity: (s) => {
    if (s <= 3) return { label: "Baixo risco", tone: "calm" };
    if (s <= 7) return { label: "Uso de risco", tone: "moderate" };
    return { label: "Alto risco", tone: "severe" };
  },
};

export const ASSESSMENTS: Record<AssessmentType, AssessmentDef> = {
  gad7: GAD7,
  phq9: PHQ9,
  dass21: DASS21,
  who5: WHO5,
  pss10: PSS10,
  auditc: AUDITC,
};

export type SubscaleResult = {
  key: string;
  name: string;
  short: string;
  score: number;
  severity: Severity;
};

export type AssessmentResult = {
  score: number;
  label: string;
  subscales: SubscaleResult[];
};

export function computeResult(
  def: AssessmentDef,
  answers: (number | null)[],
): AssessmentResult {
  const opts = def.responseOptions ?? RESPONSE_OPTIONS;
  const maxVal = Math.max(...opts.map((o) => o.value));
  const total = answers.reduce<number>((sum, a, i) => {
    const v = a ?? 0;
    return sum + (def.reverseIndices?.includes(i) ? maxVal - v : v);
  }, 0);
  if (def.subscales) {
    const subscales: SubscaleResult[] = def.subscales.map((sub) => {
      const raw =
        sub.indices.reduce<number>((sum, i) => sum + (answers[i] ?? 0), 0) *
        (sub.multiplier ?? 1);
      return {
        key: sub.key,
        name: sub.name,
        short: sub.short,
        score: raw,
        severity: sub.severity(raw),
      };
    });
    const label = subscales.map((s) => `${s.short}: ${s.severity.label}`).join(" · ");
    return { score: total, label, subscales };
  }
  return { score: total, label: def.severity(total).label, subscales: [] };
}

export const severityToneClass: Record<Tone, string> = {
  calm: "bg-primary/15 text-primary",
  mild: "bg-secondary text-secondary-foreground",
  moderate: "bg-accent text-accent-foreground",
  high: "bg-destructive/15 text-destructive",
  severe: "bg-destructive/20 text-destructive",
};
