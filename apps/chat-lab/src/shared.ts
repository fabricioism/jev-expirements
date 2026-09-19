import { z } from 'zod';

export const MODELS = { chat: 'google/gemini-3.7-flash', decision: 'typesafe/jev-1.13' } as const;
export const LIMITS = { knowledgeChars: 16_000, messageChars: 2_000, messages: 40, contextBytes: 24_000 } as const;
export const modeSchema = z.enum(['solo', 'jev']);
export const actionSchema = z.enum(['reply', 'clarify', 'handoff']);
export type Mode = z.infer<typeof modeSchema>;
export type Action = z.infer<typeof actionSchema>;
export type CaseId = 'bakery' | 'bestsign' | 'saira';
export type ScenarioId = 'bakery' | 'bestsign' | 'saira-guests' | 'saira-owners';
export type Message = { role: 'user' | 'assistant'; content: string };
export type Scenario = { id: ScenarioId; label: string; language: string; goal: string; starters: { title: string; text: string; source: string }[] };
export type BusinessCase = { id: CaseId; name: string; category: string; description: string; fictional: boolean; agentName: string; knowledge: string; sources: { label: string; url: string }[]; scenarios: Scenario[] };

export const turnInputSchema = z.object({
  scenarioId: z.enum(['bakery', 'bestsign', 'saira-guests', 'saira-owners']),
  knowledge: z.string().trim().min(1, 'El conocimiento está vacío.').max(LIMITS.knowledgeChars, 'El conocimiento supera el límite de texto.'),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(4_000) })).min(1).max(LIMITS.messages, 'Reinicia el chat para empezar una conversación nueva.'),
}).superRefine((input, ctx) => {
  if (input.messages.at(-1)?.role !== 'user') ctx.addIssue({ code: 'custom', message: 'El último mensaje debe ser del cliente.' });
  if (input.messages.some((m, i) => m.role !== (i % 2 === 0 ? 'user' : 'assistant'))) ctx.addIssue({ code: 'custom', message: 'El historial debe alternar mensajes del cliente y del agente.' });
  if (input.messages.some(m => m.role === 'user' && m.content.length > LIMITS.messageChars)) ctx.addIssue({ code: 'custom', message: 'El mensaje supera 2,000 caracteres.' });
  if (new TextEncoder().encode(JSON.stringify(input)).length > LIMITS.contextBytes) ctx.addIssue({ code: 'custom', message: 'El contexto está lleno. Acorta el conocimiento o reinicia el chat. No se ha recortado información.' });
});

export type TurnInput = z.infer<typeof turnInputSchema>;
export const parallelInputSchema = z.object({
  scenarioId: turnInputSchema.shape.scenarioId,
  knowledge: turnInputSchema.shape.knowledge,
  histories: z.object({ solo: turnInputSchema.shape.messages, jev: turnInputSchema.shape.messages }),
  modes: z.array(modeSchema).min(1).max(2).refine(modes => new Set(modes).size === modes.length, 'No repitas un modo.').default(['solo', 'jev']),
}).superRefine((input, ctx) => {
  for (const mode of input.modes) {
    const parsed = turnInputSchema.safeParse({ scenarioId: input.scenarioId, knowledge: input.knowledge, messages: input.histories[mode] });
    if (!parsed.success) for (const issue of parsed.error.issues) ctx.addIssue({ code: 'custom', message: issue.message, path: ['histories', mode, ...issue.path] });
  }
});
export type ParallelInput = z.infer<typeof parallelInputSchema>;
export type ChoiceDecision = { choice: string; confidence: number; probabilities: Record<string, number> };
export type Decision = { intent: ChoiceDecision; action: ChoiceDecision };
export type Usage = { inputTokens: number | null; outputTokens: number | null; cost: number | null };
export type TurnResult = { reply: string; action: Action; mode: Mode; decision: Decision | null; timing: { totalMs: number; jevMs: number; chatMs: number }; usage: { chat: Usage; jev: Usage | null }; models: { chat: string; jev: string | null } };
export type Outcome = { ok: true; result: TurnResult } | { ok: false; error: string };
export type ParallelResult = Partial<Record<Mode, Outcome>>;
export type Config = { cases: BusinessCase[]; configured: boolean; models: typeof MODELS; limits: typeof LIMITS };

export const actionLabels: Record<Action, string> = { reply: 'Responder', clarify: 'Pedir un dato', handoff: 'Atención humana' };
export const intentLabels: Record<string, string> = { pricing: 'Precios', product: 'Producto o servicio', logistics: 'Fechas y ubicación', process: 'Cómo funciona', complaint: 'Problema o reclamo', human: 'Hablar con una persona', other: 'Otra consulta' };
