import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, BookOpen, ChevronDown, Code2, GitCompareArrows, Info, LoaderCircle, MessageCircle, RotateCcw, Sparkles, Users, X, Zap } from 'lucide-react';
import { LIMITS, type BusinessCase, type Message, type Mode, type ParallelInput, type ParallelResult, type Scenario, type ScenarioId, type TurnInput, type TurnResult } from '../shared.ts';
import { ActionPill, DecisionView, formatTime, ResultMetrics } from './ModelDetails.tsx';
import './parallel.css';

type ChatEntry = Message & { id: string; turn: number; result?: TurnResult; input?: TurnInput };
type PendingTurn = { input: ParallelInput; turn: number; errors: Partial<Record<Mode, string>> };
type Inspection = { mode: Mode; id: string };
type Session = { messages: Record<Mode, ChatEntry[]>; draft: string; pending?: PendingTurn; inspection?: Inspection };
const modes: Mode[] = ['solo', 'jev'];
const names: Record<Mode, string> = { solo: 'Solo Gemini', jev: 'Gemini + Jev' };
const emptySession = (): Session => ({ messages: { solo: [], jev: [] }, draft: '' });

function ConversationColumn({ mode, entries, agentName, loading, error, onInspect }: {
  mode: Mode; entries: ChatEntry[]; agentName: string; loading: boolean; error?: string; onInspect: (id: string) => void;
}) {
  const body = useRef<HTMLDivElement>(null);
  const responses = entries.filter(entry => entry.result);
  const latest = responses.at(-1);

  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [entries.length, loading]);

  return <section className={`parallel-column ${mode}`} aria-label={`Conversación ${names[mode]}`}>
    <header className="parallel-column-header">
      <span className={`model-symbol ${mode}`}>{mode === 'jev' ? <Zap size={19} /> : <Sparkles size={19} />}</span>
      <div><h3>{names[mode]}</h3><p>{agentName} · {mode === 'jev' ? 'Jev decide, Gemini redacta' : 'Gemini decide y redacta'}</p></div>
      <span className="turn-count">{responses.length} {responses.length === 1 ? 'turno' : 'turnos'}</span>
    </header>
    <div className="parallel-chat-body" ref={body} role="log" aria-label={`Mensajes ${names[mode]}`} aria-live="polite">
      {entries.length === 0 && <div className="parallel-empty"><MessageCircle size={30} strokeWidth={1.4} /><h4>Tu conversación con {agentName}</h4><p>Escribe abajo como cliente. Cada agente recibe su propio historial. Comprueba si recuerda los datos y tus correcciones.</p></div>}
      {entries.map(entry => <div className={`message-row ${entry.role}`} key={entry.id}>
        <div className="message-content">
          <div className="message-label">{entry.role === 'user' ? 'Tú · Cliente' : agentName}</div>
          <div className="message-bubble">{entry.content}</div>
          {entry.result && <div className="message-meta"><ActionPill action={entry.result.action} /><span>{formatTime(entry.result.timing.totalMs)}</span><button className="inspect-turn" onClick={() => onInspect(entry.id)} aria-label={`Inspeccionar turno ${entry.turn} de ${names[mode]}`}><Code2 size={12} />Turno {entry.turn}</button></div>}
        </div>
      </div>)}
      {loading && <div className="parallel-typing"><LoaderCircle size={15} className="spinning" />{mode === 'jev' ? 'Jev decide · Gemini redacta…' : 'Gemini responde…'}</div>}
      {error && <div className="inline-error" role="alert">{error}</div>}
    </div>
    {latest?.result?.action === 'handoff' && <div className="parallel-handoff"><Users size={15} /><span>El agente propone atención humana. Es una simulación; puedes seguir conversando para probar otros mensajes.</span></div>}
  </section>;
}

function TurnInspector({ mode, entries, selection }: { mode: Mode; entries: ChatEntry[]; selection?: Inspection }) {
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const panel = useRef<HTMLDetailsElement>(null);
  const responses = entries.filter(entry => entry.result);
  const inspected = responses.find(entry => entry.id === inspectedId) ?? responses.at(-1);
  const latest = responses.at(-1);
  useEffect(() => { setInspectedId(null); }, [latest?.id]);
  useEffect(() => {
    if (selection?.mode !== mode) return;
    setInspectedId(selection.id); setInspectorOpen(true);
    requestAnimationFrame(() => panel.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }, [selection, mode]);

  return <details className={`parallel-inspector ${mode}`} ref={panel} open={inspectorOpen} onToggle={event => setInspectorOpen(event.currentTarget.open)}>
      <summary><Code2 size={15} /><strong>{names[mode]}</strong><span>{inspected ? `Turno ${inspected.turn}` : 'Sin turnos'}</span><ChevronDown size={14} /></summary>
      {inspected?.result ? <div className="parallel-inspector-body">
        <label className="turn-selector">Revisar turno<select value={inspected.id} onChange={event => setInspectedId(event.target.value)}>{responses.map(entry => <option value={entry.id} key={entry.id}>Turno {entry.turn} · {entry.input?.messages.at(-1)?.content.slice(0, 65)}</option>)}</select></label>
        <div className="inspected-prompt"><span>Mensaje del cliente</span><p>{inspected.input?.messages.at(-1)?.content}</p></div>
        <ResultMetrics result={inspected.result} />
        <dl className="technical-stats">
          <div><dt>Gemini</dt><dd>{formatTime(inspected.result.timing.chatMs)}</dd></div>
          <div><dt>Tokens Gemini · entrada / salida</dt><dd>{inspected.result.usage.chat.inputTokens ?? 'n/d'} / {inspected.result.usage.chat.outputTokens ?? 'n/d'}</dd></div>
          {inspected.result.usage.jev && <div><dt>Tokens Jev · entrada / salida</dt><dd>{inspected.result.usage.jev.inputTokens ?? 'n/d'} / {inspected.result.usage.jev.outputTokens ?? 'n/d'}</dd></div>}
          <div><dt>Mensajes enviados al modelo</dt><dd>{inspected.input?.messages.length ?? 0}</dd></div>
        </dl>
        {inspected.result.decision ? <DecisionView decision={inspected.result.decision} /> : <div className="solo-action"><span>Acción elegida por Gemini</span><ActionPill action={inspected.result.action} /></div>}
        <details className="raw-details"><summary>Ver resultado y métricas de este turno</summary><pre>{JSON.stringify(inspected.result, null, 2)}</pre></details>
        <details className="raw-details"><summary>Ver historial y conocimiento enviados</summary><pre>{JSON.stringify(inspected.input, null, 2)}</pre></details>
      </div> : <p className="parallel-inspector-empty">Después de la primera respuesta verás decisiones, tiempos, tokens y costo. Puedes inspeccionar cualquier turno del historial.</p>}
    </details>;
}

export function ParallelChat({ business, scenario, knowledge, onBusyChange, onEditKnowledge }: {
  business: BusinessCase; scenario: Scenario; knowledge: string; onBusyChange: (busy: 'compare' | null) => void; onEditKnowledge: () => void;
}) {
  const [sessions, setSessions] = useState<Partial<Record<ScenarioId, Session>>>({});
  const [running, setRunning] = useState<Mode[]>([]);
  const abort = useRef<AbortController | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const session = sessions[scenario.id] ?? emptySession();
  const busy = running.length > 0;
  const pending = session.pending;
  const failed = modes.filter(mode => Boolean(pending?.errors[mode]));
  const turns = session.messages.solo.filter(message => message.role === 'user').length;

  useEffect(() => () => abort.current?.abort(), []);

  function update(id: ScenarioId, fn: (current: Session) => Session) {
    setSessions(previous => ({ ...previous, [id]: fn(previous[id] ?? emptySession()) }));
  }

  async function request(input: ParallelInput, turn: number, requestedModes: Mode[]) {
    const id = input.scenarioId;
    setRunning(requestedModes); onBusyChange('compare');
    abort.current = new AbortController();
    let result: ParallelResult;
    try {
      const response = await fetch('/api/parallel-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, modes: requestedModes }), signal: abort.current.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo completar este turno.');
      result = data as ParallelResult;
    } catch (error) {
      const message = error instanceof Error ? error.name === 'AbortError' ? 'Solicitud cancelada. Puedes reintentar este turno.' : error.message : 'No se pudo completar este turno.';
      result = Object.fromEntries(requestedModes.map(mode => [mode, { ok: false, error: message }]));
    }
    update(id, current => {
      const messages = { ...current.messages };
      const errors = { ...current.pending?.errors };
      for (const mode of requestedModes) {
        const outcome = result[mode];
        if (outcome?.ok) {
          messages[mode] = [...messages[mode], { id: crypto.randomUUID(), role: 'assistant', content: outcome.result.reply, turn, result: outcome.result, input: { scenarioId: id, knowledge: input.knowledge, messages: input.histories[mode] } }];
          delete errors[mode];
        } else errors[mode] = outcome?.error ?? 'Este modelo no devolvió una respuesta. Puedes reintentar.';
      }
      return { ...current, messages, pending: Object.keys(errors).length > 0 ? { input, turn, errors } : undefined };
    });
    setRunning([]); onBusyChange(null); abort.current = null;
    requestAnimationFrame(() => composer.current?.focus({ preventScroll: true }));
  }

  function send(event?: FormEvent) {
    event?.preventDefault();
    if (busy || pending || !session.draft.trim()) return;
    const text = session.draft.trim();
    const turn = turns + 1;
    const input: ParallelInput = {
      scenarioId: scenario.id, knowledge, modes,
      histories: {
        solo: [...session.messages.solo.map(({ role, content }) => ({ role, content })), { role: 'user', content: text }],
        jev: [...session.messages.jev.map(({ role, content }) => ({ role, content })), { role: 'user', content: text }],
      },
    };
    update(scenario.id, current => ({ ...current, draft: '', pending: { input, turn, errors: {} }, messages: {
      solo: [...current.messages.solo, { id: crypto.randomUUID(), role: 'user', content: text, turn }],
      jev: [...current.messages.jev, { id: crypto.randomUUID(), role: 'user', content: text, turn }],
    } }));
    void request(input, turn, modes);
  }

  return <section className="parallel-view" aria-label="Chats en paralelo">
    <div className="parallel-intro"><div><h2>Dos agentes. Una conversación con cada uno.</h2><p>Tú escribes una vez. Cada agente responde y continúa con su propio historial.</p></div><button className="button secondary" disabled={busy || turns === 0} onClick={() => { update(scenario.id, emptySession); composer.current?.focus(); }}><RotateCcw size={14} />Reiniciar ambos</button></div>
    <div className="parallel-context"><span><GitCompareArrows size={14} />Mismo mensaje y conocimiento · Historial propio por agente</span><button className="text-button" disabled={busy} onClick={onEditKnowledge}><BookOpen size={14} />Editar conocimiento de {business.name}</button></div>
    <div className="parallel-grid">
      {modes.map(mode => <ConversationColumn key={`${scenario.id}-${mode}`} mode={mode} entries={session.messages[mode]} agentName={business.agentName} loading={running.includes(mode)} error={pending?.errors[mode]} onInspect={id => update(scenario.id, current => ({ ...current, inspection: { mode, id } }))} />)}
    </div>
    <form className="parallel-composer" onSubmit={send}>
      <div className="parallel-composer-heading"><label htmlFor="parallel-message">Tú, como cliente</label><span>{pending ? `Turno ${pending.turn} pendiente` : turns === 0 ? 'Empieza desde un anuncio' : `Siguiente mensaje · turno ${turns + 1}`}</span></div>
      {turns === 0 && <div className="parallel-starters">{scenario.starters.map(starter => <button key={starter.title} type="button" disabled={busy} onClick={() => { update(scenario.id, current => ({ ...current, draft: starter.text })); composer.current?.focus(); }}>{starter.title}</button>)}</div>}
      <div className="composer-input"><textarea id="parallel-message" ref={composer} rows={2} value={session.draft} disabled={busy || Boolean(pending)} maxLength={LIMITS.messageChars} placeholder={turns === 0 ? 'Hola, vi su anuncio y quisiera más información…' : 'Responde a los agentes para continuar la conversación…'} onChange={event => update(scenario.id, current => ({ ...current, draft: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />{busy ? <button className="send-button cancel" type="button" aria-label="Cancelar respuestas" onClick={() => abort.current?.abort()}><X size={18} /></button> : <button className="send-button" type="submit" aria-label="Enviar a ambos agentes" disabled={Boolean(pending) || !session.draft.trim()}><ArrowUp size={20} /></button>}</div>
      {failed.length > 0 && pending ? <div className="parallel-retry"><Info size={15} /><span>{failed.length === 2 ? 'No se completó ninguna respuesta. Reintenta este turno.' : `Falta completar ${names[failed[0]!]}. La respuesta del otro agente se conserva.`}</span><button className="text-button" type="button" disabled={busy} onClick={() => void request(pending.input, pending.turn, failed)}><RotateCcw size={13} />Reintentar {failed.length === 1 ? names[failed[0]!] : 'respuestas'}</button></div> : <div className="composer-footer"><span>{busy ? 'Los agentes están respondiendo…' : 'Cada mensaje conserva el historial completo de su conversación.'}</span><span>Enter para enviar · Shift + Enter para salto</span></div>}
    </form>
    <div className="parallel-engineering-heading"><Code2 size={15} /><h3>Inspector técnico</h3><span>Revisa el contexto, las decisiones y el costo de cada respuesta.</span></div>
    <div className="parallel-grid parallel-inspectors-grid">{modes.map(mode => <TurnInspector key={`${scenario.id}-${mode}`} mode={mode} entries={session.messages[mode]} selection={session.inspection} />)}</div>
    <p className="parallel-footnote"><Info size={13} />Los chats empiezan juntos y pueden tomar caminos distintos. Las decisiones de atención humana se muestran sin bloquear la simulación. Al recargar se borra la sesión.</p>
  </section>;
}
