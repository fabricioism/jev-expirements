import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cases } from './cases.ts';
import { runTurn, ProviderError } from './openrouter.ts';
import { LIMITS, MODELS, modeSchema, parallelInputSchema, turnInputSchema, type Outcome, type TurnResult } from '../shared.ts';

// Process environment wins, then app settings, then shared workspace settings.
config({
  path: [
    fileURLToPath(new URL('../../.env', import.meta.url)),
    fileURLToPath(new URL('../../../../.env', import.meta.url)),
  ],
  quiet: true,
});

const app = new Hono();
app.use('/api/*', bodyLimit({ maxSize: 128 * 1024, onError: c => c.json({ error: 'La solicitud supera el límite de tamaño.' }, 413) }));
app.use('/api/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  // The browser uses the Vite proxy or the same-origin production server.
  const origin = c.req.header('Origin');
  if (origin) {
    try {
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname)) return c.json({ error: 'Esta demo solo acepta solicitudes locales.' }, 403);
    } catch { return c.json({ error: 'Origen inválido.' }, 403); }
  }
  await next();
});

app.get('/api/config', c => c.json({ cases, models: MODELS, limits: LIMITS, configured: Boolean(process.env.OPENROUTER_API_KEY?.trim()) }));

function outcome(value: PromiseSettledResult<TurnResult>): Outcome {
  return value.status === 'fulfilled'
    ? { ok: true, result: value.value }
    : { ok: false, error: value.reason instanceof ProviderError ? value.reason.message : 'No se pudo completar esta respuesta.' };
}

app.post('/api/chat', async c => {
  const body: unknown = await c.req.json();
  const parsed = turnInputSchema.safeParse(body);
  const mode = modeSchema.safeParse(typeof body === 'object' && body !== null && 'mode' in body ? body.mode : undefined);
  if (!parsed.success || !mode.success) return c.json({ error: !parsed.success ? parsed.error.issues[0]?.message : 'Selecciona un modo válido.' }, 400);
  return c.json(await runTurn(parsed.data, mode.data, new Date().toISOString(), c.req.raw.signal));
});

app.post('/api/compare', async c => {
  const parsed = turnInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message }, 400);
  const referenceTime = new Date().toISOString();
  const result = await Promise.allSettled([
    runTurn(parsed.data, 'solo', referenceTime, c.req.raw.signal),
    runTurn(parsed.data, 'jev', referenceTime, c.req.raw.signal),
  ]);
  return c.json({ solo: outcome(result[0]!), jev: outcome(result[1]!) });
});

app.post('/api/parallel-chat', async c => {
  const parsed = parallelInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message }, 400);
  const { scenarioId, knowledge, histories, modes } = parsed.data;
  const referenceTime = new Date().toISOString();
  const results = await Promise.allSettled(modes.map(mode => runTurn({ scenarioId, knowledge, messages: histories[mode] }, mode, referenceTime, c.req.raw.signal)));
  return c.json(Object.fromEntries(modes.map((mode, index) => [mode, outcome(results[index]!)])));
});

app.notFound(c => c.json({ error: 'Ruta no encontrada.' }, 404));
app.onError((error, c) => {
  if (error instanceof SyntaxError) return c.json({ error: 'El cuerpo de la solicitud no es JSON válido.' }, 400);
  if (error instanceof ProviderError) return c.json({ error: error.message }, error.status);
  console.error('Chat Lab: error interno de solicitud.', error.name);
  return c.json({ error: 'No se pudo completar la solicitud. Puedes reintentar.' }, 500);
});

app.use('/*', serveStatic({ root: './dist' }));
const port = Number(process.env.CHAT_LAB_API_PORT || 4318);
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, info => {
  console.info(`Chat Lab API: http://127.0.0.1:${info.port}`);
  console.info(`OpenRouter: ${process.env.OPENROUTER_API_KEY?.trim() ? 'configurado' : 'falta OPENROUTER_API_KEY'}`);
});
