import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, ArrowUp, BookOpen, Check, Clock3, Code2, Cookie, ExternalLink, FilePenLine, FlaskConical, GitCompareArrows, Info, LoaderCircle, MessageCircle, Plus, RotateCcw, Settings2, ShieldCheck, Sparkles, TreePalm, Users, X, Zap } from 'lucide-react';
import { LIMITS, MODELS, type BusinessCase, type CaseId, type Config, type Message, type Mode, type Scenario, type ScenarioId, type TurnInput, type TurnResult } from '../shared.ts';
import { ActionPill, DecisionView, formatTime, ResultMetrics } from './ModelDetails.tsx';
import { ParallelChat } from './ParallelChat.tsx';

type ChatMessage = Message & { id: string; result?: TurnResult };
type Session = { mode: Mode; messages: ChatMessage[]; lastInput?: TurnInput; error?: string; handoff: boolean };
const freshSession = (): Session => ({ mode: 'jev', messages: [], handoff: false });
const avatars = { bakery: Cookie, bestsign: FilePenLine, saira: TreePalm };
const accents = { bakery: '#b88028', bestsign: '#6475cb', saira: '#278c80' };
const modeNames: Record<Mode, string> = { solo: 'Solo Gemini', jev: 'Gemini + Jev' };

async function api<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal });
  const data = await response.json().catch(() => ({ error: 'No se pudo leer la respuesta del servidor.' }));
  if (!response.ok) throw new Error(data.error || 'La solicitud falló. Puedes reintentar.');
  return data as T;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.name === 'AbortError' ? 'Solicitud cancelada. Puedes reintentar el mismo mensaje.' : error.message : 'La solicitud falló. Puedes reintentar.';
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function BusinessAvatar({ business, large = false }: { business: BusinessCase; large?: boolean }) {
  const Icon = avatars[business.id];
  return <span className={`business-avatar ${business.id} ${large ? 'large' : ''}`}><Icon size={large ? 30 : 20} strokeWidth={1.6} /></span>;
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loadError, setLoadError] = useState('');
  const [businessId, setBusinessId] = useState<CaseId>('bakery');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('bakery');
  const [tab, setTab] = useState<'demo' | 'compare'>('compare');
  const [sessions, setSessions] = useState<Partial<Record<ScenarioId, Session>>>({});
  const [knowledge, setKnowledge] = useState<Partial<Record<CaseId, string>>>({});
  const [drafts, setDrafts] = useState<Partial<Record<ScenarioId, string>>>({});
  const [busy, setBusy] = useState<'chat' | 'compare' | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const editorDialog = useRef<HTMLDialogElement>(null);
  const setupDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    api<Config>('/api/config', undefined, abort.signal).then(setConfig).catch(error => { if (!abort.signal.aborted) setLoadError(errorMessage(error)); });
    return () => abort.abort();
  }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [sessions, busy, tab]);
  useEffect(() => { if (editorOpen) editorDialog.current?.showModal(); else editorDialog.current?.close(); }, [editorOpen]);
  useEffect(() => { if (setupOpen) setupDialog.current?.showModal(); else setupDialog.current?.close(); }, [setupOpen]);
  useEffect(() => () => controller.current?.abort(), []);

  if (!config) return <div className="app-loading"><BrandMark /><h1>Chat Lab</h1>{loadError ? <><p role="alert">{loadError}</p><button className="button primary" onClick={() => window.location.reload()}>Reintentar</button></> : <p><LoaderCircle size={16} className="spinning" />Preparando los negocios…</p>}</div>;

  const business = config.cases.find(c => c.id === businessId)!;
  const scenario = business.scenarios.find(s => s.id === scenarioId)!;
  const session = sessions[scenarioId] ?? freshSession();
  const currentKnowledge = knowledge[businessId] ?? business.knowledge;
  const latestResult = session.messages.findLast(m => m.result)?.result;
  const edited = currentKnowledge !== business.knowledge;
  const draft = drafts[scenarioId] ?? '';
  const canSend = !busy && !session.handoff && !session.error && !!draft.trim();

  function updateSession(id: ScenarioId, update: (s: Session) => Session) {
    setSessions(prev => ({ ...prev, [id]: update(prev[id] ?? freshSession()) }));
  }

  function selectCase(next: BusinessCase) {
    setBusinessId(next.id); setScenarioId(next.scenarios[0]!.id);
  }

  function selectScenario(next: Scenario) {
    setScenarioId(next.id);
  }

  function newChat() {
    updateSession(scenarioId, () => ({ ...freshSession(), mode: session.mode }));
    setDrafts(prev => ({ ...prev, [scenarioId]: '' }));
    composer.current?.focus();
  }

  async function sendMessage(text: string, retry = false) {
    if (busy || !text.trim() && !retry) return;
    const id = scenarioId;
    const input: TurnInput = retry && session.lastInput ? session.lastInput : {
      scenarioId: id, knowledge: currentKnowledge,
      messages: [...session.messages.map(({ role, content }) => ({ role, content })), { role: 'user', content: text.trim() }],
    };
    if (!retry) updateSession(id, s => ({ ...s, messages: [...s.messages, { id: crypto.randomUUID(), role: 'user', content: text.trim() }], lastInput: input, error: undefined }));
    else updateSession(id, s => ({ ...s, error: undefined }));
    setDrafts(prev => ({ ...prev, [id]: '' }));
    setBusy('chat');
    controller.current = new AbortController();
    try {
      const result = await api<TurnResult>('/api/chat', { ...input, mode: session.mode }, controller.current.signal);
      updateSession(id, s => ({ ...s, messages: [...s.messages, { id: crypto.randomUUID(), role: 'assistant', content: result.reply, result }], error: undefined, handoff: result.action === 'handoff' }));
    } catch (error) { updateSession(id, s => ({ ...s, error: errorMessage(error) })); }
    finally { setBusy(null); controller.current = null; }
  }

  function openComparison() { setTab('compare'); }

  async function refreshConnection() {
    try { setConfig(await api<Config>('/api/config')); }
    catch (error) { setLoadError(errorMessage(error)); }
  }

  return <div className={`app-shell ${tab === 'compare' ? 'parallel-active' : ''}`} style={{ '--business-accent': accents[businessId] } as CSSProperties}>
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Chat Lab, volver al inicio"><BrandMark /><span>Jev<span className="brand-divider">/</span><strong>Chat Lab</strong></span></a>
      <div className="workspace-label"><FlaskConical size={13} /><span>EXPERIMENTO 01</span><span className="local-tag">Local</span></div>
      <div className="sidebar-section-label">CASOS DE USO <span>03</span></div>
      <nav className="business-list" aria-label="Casos de uso">{config.cases.map(c => <button key={c.id} className={`business-button ${c.id === businessId ? 'selected' : ''}`} onClick={() => selectCase(c)} disabled={!!busy} aria-pressed={c.id === businessId}>
        <BusinessAvatar business={c} /><span><strong>{c.name}</strong><small>{c.category}</small></span><span className="selection-dot" />
      </button>)}</nav>
      <div className="sidebar-note"><span className="note-icon"><FlaskConical size={17} /></span><strong>¿Cuándo ayuda Jev?</strong><p>Compara cuándo cada agente responde, pide un dato o solicita atención humana.</p><div><span className="tiny-dot" />Sin mensajes reales de WhatsApp</div></div>
      <div className="sidebar-footer"><div className="provider-line"><Code2 size={16} /><strong>OpenRouter</strong><button onClick={() => setSetupOpen(true)} title="Configurar OpenRouter" aria-label="Configurar OpenRouter"><Settings2 size={16} /></button></div><button className="connection-status" onClick={() => setSetupOpen(true)}><span className={`tiny-dot ${config.configured ? 'green' : 'amber'}`} />{config.configured ? 'API key configurada' : 'Falta la API key'}<ArrowRight size={12} /></button><p>Gemini 3.7 Flash · Jev 1.13</p></div>
    </aside>

    <main className="workspace">
      <header className="topbar"><div><span>Laboratorio</span><span className="slash">/</span><strong>Chat con conocimiento</strong></div><span className="session-note"><span className="tiny-dot" />Sesión en memoria</span></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">EXPERIMENTO DE ATENCIÓN COMERCIAL</div><h1>¿Qué aporta Jev a un chat de ventas?</h1><p>Escribe como alguien que llega desde un anuncio. Compara las respuestas y revisa cada decisión.</p></div><span className="poc-badge"><FlaskConical size={14} />Prueba de concepto</span></div>
        <div className="toolbar"><div className="tabs" role="tablist" aria-label="Vista"><button id="demo-tab" role="tab" aria-selected={tab === 'demo'} aria-controls="demo-panel" className={tab === 'demo' ? 'active' : ''} onClick={() => setTab('demo')} disabled={!!busy}><MessageCircle size={16} />Un chat</button><button id="compare-tab" role="tab" aria-selected={tab === 'compare'} aria-controls="compare-panel" className={tab === 'compare' ? 'active' : ''} onClick={() => openComparison()} disabled={!!busy}><GitCompareArrows size={17} />Chats en paralelo</button></div><div className="business-context"><span className={`data-badge ${business.fictional ? '' : 'public'}`}>{business.fictional ? 'Datos ficticios' : 'Fuentes públicas'}</span><span>{scenario.language === 'Español' ? 'ES' : 'PT-BR'}</span></div></div>
        {business.scenarios.length > 1 && <div className="journey-bar"><span>Conversar como</span><div className="segmented">{business.scenarios.map(s => <button key={s.id} className={s.id === scenarioId ? 'selected' : ''} disabled={!!busy} onClick={() => selectScenario(s)}>{s.label}</button>)}</div></div>}
        {!config.configured && <div className="setup-banner"><Info size={17} /><span>Los negocios están listos. Conecta OpenRouter para conversar con los modelos.</span><button onClick={() => setSetupOpen(true)}>Configurar<ArrowRight size={14} /></button></div>}

        {tab === 'demo' ? <div className="demo-layout" id="demo-panel" role="tabpanel" aria-labelledby="demo-tab">
          <section className="chat-card">
            <header className="chat-header"><BusinessAvatar business={business} /><div><h2>{business.name}</h2><p>{business.agentName} · {scenario.label}</p></div><button className="icon-button" onClick={newChat} disabled={!!busy || session.messages.length === 0} title="Reiniciar conversación" aria-label="Reiniciar conversación"><RotateCcw size={17} /></button></header>
            <div className="mode-bar"><span>Modo de respuesta</span><div className="segmented mode-selector">{(['solo', 'jev'] as const).map(mode => <button key={mode} className={session.mode === mode ? 'selected' : ''} disabled={!!busy || session.messages.length > 0} onClick={() => updateSession(scenarioId, s => ({ ...s, mode }))}>{mode === 'jev' ? <Zap size={13} /> : <Sparkles size={13} />}{modeNames[mode]}</button>)}</div></div>
            <div className="chat-body" aria-live="polite" aria-relevant="additions">
              {session.messages.length === 0 ? <div className="chat-empty"><div className="empty-avatar"><BusinessAvatar business={business} large /><span><MessageCircle size={14} /></span></div><span className="empty-kicker">EL CLIENTE ACABA DE LLEGAR</span><h3>Empieza una conversación</h3><p>Elige un mensaje de ejemplo o escribe el tuyo.<br />{business.agentName} usará el conocimiento de {business.name}.</p><div className="starter-list">{scenario.starters.map((starter, index) => <button key={starter.title} disabled={!!busy} onClick={() => { setDrafts(prev => ({ ...prev, [scenarioId]: starter.text })); composer.current?.focus(); }}><span className="starter-number">0{index + 1}</span><span><strong>{starter.title}</strong><small>{starter.source}</small></span><ArrowUp size={15} /></button>)}</div></div>
                : <><div className="conversation-date">Conversación de prueba · {scenario.language}</div>{session.messages.map(m => <div key={m.id} className={`message-row ${m.role}`}>
                  {m.role === 'assistant' && <BusinessAvatar business={business} />}
                  <div className="message-content"><div className="message-label">{m.role === 'user' ? 'Tú, como cliente' : business.agentName}</div><div className="message-bubble">{m.content}</div>{m.result && <div className="message-meta"><ActionPill action={m.result.action} /><span>{formatTime(m.result.timing.totalMs)}</span></div>}</div>
                </div>)}</>}
              {busy === 'chat' && <div className="typing-indicator"><BusinessAvatar business={business} /><span><i /><i /><i /></span><small>{session.mode === 'jev' ? 'Jev decide · Gemini redacta' : 'Gemini prepara su respuesta'}</small></div>}
              {session.error && <div className="chat-error" role="alert"><Info size={17} /><div><strong>La respuesta no se completó</strong><p>{session.error}</p><button className="text-button" onClick={() => sendMessage('', true)} disabled={!!busy}><RotateCcw size={13} />Reintentar este mensaje</button></div></div>}
              {session.handoff && <div className="handoff-notice"><Users size={17} /><div><strong>Atención humana simulada</strong><p>La IA se detiene aquí. No se ha notificado a una persona real.</p><button className="text-button" onClick={newChat}><Plus size={13} />Empezar otro chat</button></div></div>}
              <div ref={bottom} />
            </div>
            <form className="composer" onSubmit={e => { e.preventDefault(); if (canSend) void sendMessage(draft); }}><div className="composer-input"><textarea ref={composer} aria-label="Mensaje del cliente" placeholder={session.handoff ? 'El chat requiere atención humana.' : 'Escribe como si llegaras desde un anuncio…'} value={draft} maxLength={LIMITS.messageChars} disabled={!!busy || session.handoff || !!session.error} onChange={e => setDrafts(prev => ({ ...prev, [scenarioId]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canSend) void sendMessage(draft); } }} rows={2} />{busy === 'chat' ? <button className="send-button cancel" type="button" aria-label="Cancelar solicitud" onClick={() => controller.current?.abort()}><X size={18} /></button> : <button className="send-button" type="submit" disabled={!canSend} aria-label="Enviar mensaje"><ArrowUp size={20} /></button>}</div><div className="composer-footer"><span><ShieldCheck size={12} />Solo una simulación de chat</span><span>Enter para enviar <span className="desktop-only">· Shift + Enter para salto</span></span></div></form>
          </section>

          <aside className="inspector">
            <section className="inspector-card knowledge-card"><div className="card-heading"><span className="heading-icon"><BookOpen size={17} /></span><h2>Conocimiento del negocio</h2>{edited && <span className="edited-dot" title="Texto editado en esta sesión" />}</div><p className="card-description">Esta es la información que recibe el agente en cada mensaje.</p><div className="knowledge-preview">{currentKnowledge.split('\n').filter(line => line.startsWith('## ')).slice(0, 6).map((line, i) => <div key={`${i}-${line}`}><span className="document-icon"><FilePenLine size={13} /></span><span>{line.replace(/^## /, '')}</span><Check size={12} /></div>)}</div><button className="button secondary full-width" disabled={!!busy} onClick={() => { setEditorText(currentKnowledge); setEditorOpen(true); }}><BookOpen size={14} />Ver y editar conocimiento<ArrowRight size={14} /></button><div className="knowledge-meta"><span>{currentKnowledge.length.toLocaleString('es')} caracteres</span><span>{edited ? 'Editado en esta sesión' : 'Texto precargado'}</span></div></section>
            <section className="inspector-card"><div className="card-heading"><span className="heading-icon purple"><Zap size={17} /></span><h2>Decisiones de Jev</h2><span className="small-tag">EN VIVO</span></div>{latestResult?.decision ? <DecisionView decision={latestResult.decision} /> : <div className="decision-empty"><span className="orbit-icon"><Zap size={22} strokeWidth={1.4} /></span><p>{session.mode === 'solo' ? 'Este chat usa solo Gemini.' : 'Aquí verás qué decide Jev.'}</p><small>{session.mode === 'solo' ? 'Reinicia para elegir otro modo o abre Chats en paralelo.' : 'Intención, siguiente acción y confianza después de cada respuesta.'}</small></div>}</section>
            {latestResult && <section className="inspector-card compact"><div className="card-heading"><Clock3 size={15} /><h2>Último turno</h2></div><ResultMetrics result={latestResult} /><details className="raw-details"><summary>Ver métricas y decisiones de este turno</summary><pre>{JSON.stringify({ models: latestResult.models, timing: latestResult.timing, usage: latestResult.usage, decision: latestResult.decision }, null, 2)}</pre></details></section>}
            <button className="compare-callout" disabled={!!busy} onClick={() => openComparison()}><GitCompareArrows size={21} /><span><strong>Conversar con ambos modos</strong><small>Abre dos chats paralelos. Este chat se conserva.</small></span><ArrowRight size={16} /></button>
            <p className="memory-note"><Info size={13} />Al recargar se borran los chats y las ediciones.</p>
          </aside>
        </div> : null}
        <div id="compare-panel" role="tabpanel" aria-labelledby="compare-tab" hidden={tab !== 'compare'}>
          <ParallelChat business={business} scenario={scenario} knowledge={currentKnowledge} onBusyChange={setBusy} onEditKnowledge={() => { setEditorText(currentKnowledge); setEditorOpen(true); }} />
        </div>
        <footer className="page-footer"><span>CHAT LAB <span className="footer-dot">·</span> EXPERIMENTOS CON JEV</span><span>Datos en memoria <span className="footer-dot">·</span> Modelos por OpenRouter</span></footer>
      </div>
    </main>

    <dialog ref={editorDialog} className="modal knowledge-modal" onCancel={() => setEditorOpen(false)} onClick={e => { if (e.target === e.currentTarget) setEditorOpen(false); }}><div className="modal-header"><div><span className="eyebrow">CONOCIMIENTO</span><h2>{business.name}</h2></div><button className="icon-button" aria-label="Cerrar editor" onClick={() => setEditorOpen(false)}><X size={20} /></button></div><p className="modal-description">Edita un precio, cambia una condición o pega tu propio texto. El agente recibirá todo este contenido en el siguiente mensaje.</p><label className="sr-only" htmlFor="knowledge-editor">Conocimiento de {business.name}</label><textarea id="knowledge-editor" className="knowledge-editor" value={editorText} onChange={e => setEditorText(e.target.value)} maxLength={LIMITS.knowledgeChars} spellCheck={false} /><div className="editor-counter"><span>{business.fictional ? 'Datos ficticios para experimentar' : 'Información pública · consultada el 2026-09-19'}</span><span>{editorText.length.toLocaleString('es')} / {LIMITS.knowledgeChars.toLocaleString('es')}</span></div>{business.sources.length > 0 && <div className="source-links">{business.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}<ExternalLink size={11} /></a>)}</div>}<div className="modal-footer"><button className="text-button" onClick={() => setEditorText(business.knowledge)}><RotateCcw size={14} />Restaurar ejemplo</button><div><button className="button secondary" onClick={() => setEditorOpen(false)}>Cancelar</button><button className="button primary" disabled={!editorText.trim()} onClick={() => { setKnowledge(prev => ({ ...prev, [businessId]: editorText.trim() })); setEditorOpen(false); }}><Check size={15} />Usar este conocimiento</button></div></div><p className="modal-bottom-note">Los cambios duran hasta que recargues la página. Cada turno conserva el conocimiento con el que se ejecutó.</p></dialog>

    <dialog ref={setupDialog} className="modal setup-modal" onCancel={() => setSetupOpen(false)} onClick={e => { if (e.target === e.currentTarget) setSetupOpen(false); }}><div className="modal-header"><div><span className="eyebrow">CONEXIÓN</span><h2>Conecta OpenRouter</h2></div><button className="icon-button" aria-label="Cerrar configuración" onClick={() => setSetupOpen(false)}><X size={20} /></button></div><p className="modal-description">La API key se configura en el servidor. El navegador nunca la recibe.</p><ol className="setup-steps"><li>Copia <code>.env.example</code> a <code>.env</code> dentro de <code>apps/chat-lab</code>.</li><li>Agrega tu API key de OpenRouter:</li></ol><div className="code-snippet"><code>OPENROUTER_API_KEY=tu_api_key</code><button title="Copiar nombre de la variable" onClick={async () => { try { await navigator.clipboard.writeText('OPENROUTER_API_KEY='); setCopied(true); } catch { setCopied(false); } }}>{copied ? <Check size={15} /> : <Code2 size={15} />}</button></div><p className="setup-restart">Reinicia <code>pnpm dev:chat-lab</code> y comprueba la conexión.</p><div className="setup-models"><span>Chat<strong>{MODELS.chat}</strong></span><span>Decisiones<strong>{MODELS.decision}</strong></span></div>{loadError && <p className="inline-error">{loadError}</p>}<div className="modal-footer"><span className="connection-status"><span className={`tiny-dot ${config.configured ? 'green' : 'amber'}`} />{config.configured ? 'API key configurada (sin validar)' : 'API key pendiente'}</span><button className="button primary" onClick={refreshConnection}><RotateCcw size={14} />Comprobar configuración</button></div></dialog>
  </div>;
}
