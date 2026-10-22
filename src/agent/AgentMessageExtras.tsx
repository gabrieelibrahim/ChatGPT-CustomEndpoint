import { useState } from 'react';
import { RichText } from '../components/RichText';
import { answerAgent, canAnswerAgent, type AgentMessageState, type AgentItem } from './mainClient';
import { safeAgentItem } from './agentItem';
import { SafeWidget } from './SafeWidget';
import './agent-message.css';

function Question({ item, state }: { item: AgentItem; state: AgentMessageState }) {
  const [answer, setAnswer] = useState('');
  return <form className="ai-card" onSubmit={event => { event.preventDefault(); if (answer.trim()) answerAgent(state.runId!, { kind: 'answer', itemId: item.id, text: answer }); }}>{item.inputs?.map(input => <label key={input.id}>{input.question}{input.options && <div className="ai-options">{input.options.map(option => <button type="button" key={option.value} aria-pressed={answer === option.value} onClick={() => setAnswer(option.value)}>{option.value}</button>)}</div>}<input aria-label={input.question} value={answer} maxLength={2000} disabled={!state.pending || !canAnswerAgent(state.runId)} onChange={event => setAnswer(event.target.value)}/></label>)}<button disabled={!answer.trim() || !state.pending || !canAnswerAgent(state.runId)}>Kirim jawaban</button></form>;
}
// Only what the person acts on or the answer itself needs: a notice, widgets, questions and images. Progress lines,
// the agent's step list and a sources list are not shown; the blue dot alone marks a running answer.
export function AgentMessageExtras({ state }: { state?: AgentMessageState; streaming?: boolean }) {
  if (!state) return null;
  const items = (Array.isArray(state.items) ? state.items : []).map(safeAgentItem).filter((item): item is AgentItem => !!item).slice(0, 64);
  return <div className="ai-message-extras">{typeof state.notice === 'string' && state.notice && <p className="ai-tool-notice" role="status">{state.notice}</p>}{items.map(item => item.type === 'widget' && item.widget ? <SafeWidget key={item.id} state={state} itemId={item.id} widget={item.widget}/> : item.type === 'structured_input' ? item.status === 'pending' ? <Question key={item.id} item={item} state={state}/> : <p key={item.id}>Jawaban diterima.</p> : item.type === 'generated_image' && item.image ? <RichText key={item.id} text={`![Gambar hasil AI](${item.image.url})`}/> : null)}</div>;
}

