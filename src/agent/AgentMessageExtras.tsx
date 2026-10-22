import { useState } from 'react';
import { RichText } from '../components/RichText';
import { answerAgent, canAnswerAgent, type AgentMessageState, type AgentItem } from './mainClient';
import { safeAgentItem } from './agentItem';
import { SafeWidget } from './SafeWidget';
import { activityLabels } from './toolActivity';
import './agent-message.css';

function Question({ item, state }: { item: AgentItem; state: AgentMessageState }) {
  const [answer, setAnswer] = useState('');
  return <form className="ai-card" onSubmit={event => { event.preventDefault(); if (answer.trim()) answerAgent(state.runId!, { kind: 'answer', itemId: item.id, text: answer }); }}>{item.inputs?.map(input => <label key={input.id}>{input.question}{input.options && <div className="ai-options">{input.options.map(option => <button type="button" key={option.value} aria-pressed={answer === option.value} onClick={() => setAnswer(option.value)}>{option.value}</button>)}</div>}<input aria-label={input.question} value={answer} maxLength={2000} disabled={!state.pending || !canAnswerAgent(state.runId)} onChange={event => setAnswer(event.target.value)}/></label>)}<button disabled={!answer.trim() || !state.pending || !canAnswerAgent(state.runId)}>Kirim jawaban</button></form>;
}
export function AgentMessageExtras({ state, streaming = false, compact = false }: { state?: AgentMessageState; streaming?: boolean; compact?: boolean }) {
  if (!state) return null;
  const items = (Array.isArray(state.items) ? state.items : []).map(safeAgentItem).filter((item): item is AgentItem => !!item).slice(0, 64);
  const sources = (Array.isArray(state.sources) ? state.sources : []).filter(source => { try { if (typeof source?.url !== 'string' || typeof source?.title !== 'string') return false; const url = new URL(source.url); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } });
  return <div className="ai-message-extras">{typeof state.notice === 'string' && state.notice && <p className="ai-tool-notice" role="status">{state.notice}</p>}{streaming && state.active && typeof state.progress === 'string' && state.progress && (!compact || !/^memproses[.\s…]*$/i.test(state.progress)) && <div className="ai-progress" role="status"><span/>{state.progress}</div>}{items.some(item => item.activity) && <details className="ai-activity" open={streaming || undefined}><summary>Langkah agent</summary><ol>{items.filter(item => item.activity).map(item => { const a = item.activity!; const status = !streaming && a.status === 'running' ? 'unconfirmed' : !streaming && a.status === 'waiting' ? 'cancelled' : a.status; return <li key={item.id} data-status={status}><strong>{a.name}</strong><span>{activityLabels[status]}</span></li>; })}</ol></details>}{items.map(item => item.type === 'widget' && item.widget ? <SafeWidget key={item.id} state={state} itemId={item.id} widget={item.widget}/> : item.type === 'structured_input' ? item.status === 'pending' ? <Question key={item.id} item={item} state={state}/> : <p key={item.id}>Jawaban diterima.</p> : item.type === 'generated_image' && item.image ? <RichText key={item.id} text={`![Gambar hasil AI](${item.image.url})`}/> : null)}{!!sources.length && <details className="ai-sources"><summary>Sumber · {sources.length}</summary><ul>{sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<small>{source.url.replace(/^https?:\/\//, '').split('/')[0]}</small></a></li>)}</ul></details>}</div>;
}
