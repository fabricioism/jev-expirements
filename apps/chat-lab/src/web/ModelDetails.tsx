import { Check, Clock3, MessageCircle, Users, Zap } from 'lucide-react';
import { actionLabels, intentLabels, type Action, type Decision, type TurnResult } from '../shared.ts';

export const formatTime = (ms: number) => ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;

export function ActionPill({ action }: { action: Action }) {
  return <span className={`action-pill ${action}`}>{action === 'handoff' ? <Users size={12} /> : action === 'clarify' ? <MessageCircle size={12} /> : <Check size={12} />}{actionLabels[action]}</span>;
}

export function DecisionView({ decision }: { decision: Decision }) {
  return <div className="decision-view">
    <div className="decision-summary"><span>Intención</span><strong>{intentLabels[decision.intent.choice] || decision.intent.choice}</strong></div>
    <div className="decision-summary"><span>Siguiente acción</span><ActionPill action={decision.action.choice as Action} /></div>
    <div className="decision-summary"><span>Confianza de la acción</span><strong>{Math.round(decision.action.confidence * 100)}%</strong></div>
    <div className="probability-list">{Object.entries(decision.action.probabilities).sort((a, b) => b[1] - a[1]).map(([key, value]) => <div className="probability" key={key}>
      <div><span>{actionLabels[key as Action] || key}</span><span>{Math.round(value * 100)}%</span></div>
      <div className="probability-track"><i style={{ width: `${value * 100}%` }} /></div>
    </div>)}</div>
    <p className="fine-print">La confianza indica cuánto se concentra la elección de Jev en una opción. No mide la calidad de la respuesta de Gemini.</p>
  </div>;
}

export function ResultMetrics({ result }: { result: TurnResult }) {
  const geminiCost = result.usage.chat.cost;
  const jevCost = result.usage.jev?.cost ?? null;
  const totalCost = geminiCost !== null && (result.mode === 'solo' || jevCost !== null)
    ? geminiCost + (jevCost ?? 0) : null;
  const money = (cost: number | null) => cost === null ? 'No informado' : `USD ${cost.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 9 })}`;
  return <div className="result-summary">
    <div className="result-metrics">
      <span><Clock3 size={13} />{formatTime(result.timing.totalMs)} total</span>
      {result.mode === 'jev' && <span><Zap size={13} />Jev {formatTime(result.timing.jevMs)}</span>}
    </div>
    <div className="cost-breakdown" aria-label="Costo por modelo de esta respuesta">
      <div className="cost-heading">Costo por modelo</div>
      <dl>
        <div><dt>Gemini</dt><dd>{money(geminiCost)}</dd></div>
        <div className={result.mode === 'jev' ? 'jev-cost' : ''}><dt>Jev</dt><dd>{result.mode === 'solo' ? 'No utilizado' : money(jevCost)}</dd></div>
        <div className="total-cost"><dt>Total de esta respuesta</dt><dd>{money(totalCost)}</dd></div>
      </dl>
      <p>Valores reportados por OpenRouter para esta respuesta.</p>
    </div>
  </div>;
}
