import { useEffect, useState } from 'react';
import { UIIcon as I } from '../components/UIIcon';
import { RichText } from '../components/RichText';

export type StreamTool = { id: string; type: string; status?: string; command?: string; aggregatedOutput?: string; changes?: { path: string; diff?: string; kind?: { type: string } }[]; server?: string; tool?: string };
export type StreamEntry = { id: string; kind: 'message' | 'tool' | 'summary'; text?: string; item?: StreamTool; startedAt: number; endedAt?: number };
type StreamEvent = { type: string; itemId?: string; delta?: string; text?: string; item?: StreamTool };
const running = (status?: string) => !status || status === 'inProgress' || status === 'in_progress' || status === 'running';

export function updateAgentStream(entries: StreamEntry[], event: StreamEvent, now = Date.now()): StreamEntry[] {
  if (!['text', 'message', 'item', 'output', 'summary'].includes(event.type)) return entries;
  const kind = event.type === 'item' || event.type === 'output' ? 'tool' : event.type === 'summary' ? 'summary' : 'message';
  const id = event.item?.id || event.itemId || (kind === 'message' ? 'answer' : 'summary');
  const index = entries.findIndex(entry => entry.id === id && entry.kind === kind);
  const previous = entries[index];
  if (event.type === 'output' && !previous) return entries;
  const entry: StreamEntry = previous ? { ...previous } : { id, kind, startedAt: now };
  if (event.type === 'text' || event.type === 'summary') entry.text = ((entry.text || '') + (event.delta || '')).slice(-1024 * 1024);
  if (event.type === 'message') entry.text = (event.text || '').slice(-1024 * 1024);
  if (event.type === 'item') {
    entry.item = { ...entry.item, ...event.item } as StreamTool;
    if (!running(entry.item.status)) entry.endedAt = now;
  }
  if (event.type === 'output') entry.item = { ...entry.item!, aggregatedOutput: ((entry.item?.aggregatedOutput || '') + (event.delta || '')).slice(-50000) };
  if (kind === 'summary') return [...entries.filter(value => value.kind !== 'summary'), entry].slice(-100);
  return index < 0 ? [...entries, entry].slice(-100) : entries.map((value, i) => i === index ? entry : value);
}

export function AgentStream({ entries, streaming }: { entries: StreamEntry[]; streaming: boolean }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!streaming) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [streaming]);
  return <div className="d-agent-stream">{entries.map((entry, index) => {
    if (entry.kind === 'message') return entry.text ? <div className="d-assistant-message" key={'message-' + entry.id}><RichText text={entry.text}/></div> : null;
    if (entry.kind === 'summary') return streaming && index === entries.length - 1 && entry.text ? <p key={'summary-' + entry.id} className="d-agent-stream-summary"><span>{entry.text}</span></p> : null;
    const item = entry.item!;
    const active = streaming && running(item.status);
    const seconds = Math.max(0, Math.floor(((entry.endedAt || now) - entry.startedAt) / 1000));
    const command = item.type === 'commandExecution';
    const failed = item.status === 'failed' || item.status === 'declined';
    const label = command ? (failed ? 'Command failed' : active ? (seconds ? `Running command for ${seconds}s` : 'Running') : 'Ran') : active ? 'Running' : failed ? 'Failed' : 'Completed';
    const description = item.command || (item.type === 'fileChange' ? 'File changes' : item.type === 'mcpToolCall' ? [item.server, item.tool].filter(Boolean).join(' / ') : item.type);
    return <details className="d-agent-stream-tool" key={'tool-' + entry.id}>
      <summary><I name={command ? 'terminal' : item.type === 'fileChange' ? 'page' : 'plugin'} size={18}/><span title={description}>{active && command && seconds > 0 ? label : `${label} ${description}`}</span><I name="down" size={12}/></summary>
      <div className="d-agent-stream-output">{command && <><small>Shell</small><pre>$ {item.command}</pre></>}{item.aggregatedOutput && <pre>{item.aggregatedOutput}</pre>}{item.changes?.map(change => <div key={change.path}><b>{change.path}</b><pre>{change.diff || change.kind?.type}</pre></div>)}</div>
    </details>;
  })}</div>;
}
