import { useState } from 'react';
import { RichText } from '../components/RichText';
import { answerAgent, canAnswerAgent, type AgentMessageState, type AgentItem } from './mainClient';
import type { Widgets } from '@openai/chatkit';
import './agent-message.css';

function CardContent({ widget, state, itemId }: { widget: Widgets.WidgetRoot; state: AgentMessageState; itemId: string }) {
  return <div className="ai-card">{('children' in widget ? widget.children : []).map((part, index) => {
    if (part.type === 'Text' || part.type === 'Title' || part.type === 'Caption') return <p key={index}>{part.value}</p>;
    if (part.type === 'Markdown') return <RichText key={index} text={part.value}/>;
    if (part.type !== 'Button') return null;
    const action = part.onClickAction, payload = action?.payload;
    if (action?.type === 'checklist.copy') return <button key={index} onClick={() => void navigator.clipboard.writeText(String(payload?.text || '')).catch(() => {})}>{part.label}</button>;
    if (action?.type !== 'tool.approve') return null;
    return <button key={index} disabled={!state.pending || !canAnswerAgent(state.runId)} onClick={() => answerAgent(state.runId!, { kind: 'approval', itemId, callId: String(payload?.callId), allow: payload?.allow === true })}>{part.label}</button>;
  })}</div>;
}
function Question({ item, state }: { item: AgentItem; state: AgentMessageState }) {
  const [answer, setAnswer] = useState('');
  return <form className="ai-card" onSubmit={event => { event.preventDefault(); if (answer.trim()) answerAgent(state.runId!, { kind: 'answer', itemId: item.id, text: answer }); }}>{item.inputs?.map(input => <label key={input.id}>{input.question}{input.options && <div className="ai-options">{input.options.map(option => <button type="button" key={option.value} aria-pressed={answer === option.value} onClick={() => setAnswer(option.value)}>{option.value}</button>)}</div>}<input aria-label={input.question} value={answer} maxLength={2000} disabled={!state.pending || !canAnswerAgent(state.runId)} onChange={event => setAnswer(event.target.value)}/></label>)}<button disabled={!answer.trim() || !state.pending || !canAnswerAgent(state.runId)}>Kirim jawaban</button></form>;
}
export function AgentMessageExtras({ state, streaming = false, compact = false }: { state?: AgentMessageState; streaming?: boolean; compact?: boolean }) {
  if (!state) return null;
  const sources = state.sources.filter(source => { try { const url = new URL(source.url); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } });
  return <div className="ai-message-extras">{state.notice && <p className="ai-tool-notice" role="status">{state.notice}</p>}{streaming && state.active && state.progress && (!compact || !/^memproses[.\s…]*$/i.test(state.progress)) && <div className="ai-progress" role="status"><span/>{state.progress}</div>}{state.items.map(item => item.type === 'widget' && item.widget ? <CardContent key={item.id} state={state} itemId={item.id} widget={item.widget}/> : item.type === 'structured_input' ? item.status === 'pending' ? <Question key={item.id} item={item} state={state}/> : <p key={item.id}>Jawaban diterima.</p> : item.type === 'generated_image' && item.image ? <RichText key={item.id} text={`![Gambar hasil AI](${item.image.url})`}/> : null)}{!!sources.length && <details className="ai-sources"><summary>Sumber · {sources.length}</summary><ul>{sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<small>{source.url.replace(/^https?:\/\//, '').split('/')[0]}</small></a></li>)}</ul></details>}</div>;
}
