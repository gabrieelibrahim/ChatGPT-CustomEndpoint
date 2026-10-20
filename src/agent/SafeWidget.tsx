import { memo, useMemo, useState, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { sanitizeWidget, type SafeWidget as Node } from './safeWidgets';
import { answerAgent, canAnswerAgent, type AgentMessageState } from './mainClient';

function WidgetButton({ node, state, itemId }: { node: Node; state: AgentMessageState; itemId: string }) {
  const [status, setStatus] = useState('');
  const action = node.action, enabled = action?.type === 'checklist.copy' || action?.type === 'tool.approve' && state.pending && canAnswerAgent(state.runId);
  return <span><button type="button" disabled={!enabled} title={!action ? 'Tindakan komponen belum didukung' : undefined} onClick={async () => {
    if (action?.type === 'checklist.copy') { try { await navigator.clipboard.writeText(action.text || ''); setStatus('Disalin'); } catch { setStatus('Penyalinan tidak tersedia'); } }
    else if (action?.type === 'tool.approve' && state.pending && canAnswerAgent(state.runId)) answerAgent(state.runId!, { kind: 'approval', itemId, callId: action.callId!, allow: action.allow === true });
  }}>{node.label}</button>{status && <small role="status">{status}</small>}</span>;
}
function render(node: Node, state: AgentMessageState, itemId: string, key: string | number): ReactNode {
  const children = node.children?.map((child, i) => render(child, state, itemId, child.key || i));
  if (node.type === 'Markdown') return <RichText key={key} text={node.value || ''}/>;
  if (node.type === 'Title') return <h3 key={key}>{node.value}</h3>;
  if (node.type === 'Text') return <p key={key}>{node.value}</p>;
  if (node.type === 'Caption') return <small key={key}>{node.value}</small>;
  if (node.type === 'Badge') return <span className="ai-widget-badge" key={key}>{node.value}</span>;
  if (node.type === 'Divider') return <hr key={key}/>;
  if (node.type === 'Spacer') return <div key={key} aria-hidden="true" className="ai-widget-spacer"/>;
  if (node.type === 'Button') return <WidgetButton key={key} node={node} state={state} itemId={itemId}/>;
  if (node.type === 'Unsupported') return <p className="ai-widget-unsupported" key={key}>{node.label}</p>;
  if (node.type === 'Table') return <div className="ai-widget-table" key={key}><table><tbody>{children}</tbody></table></div>;
  if (node.type === 'TableRow') return <tr key={key}>{children}</tr>;
  if (node.type === 'TableCell') return <td key={key}>{children}</td>;
  return <div className={'ai-widget-layout ai-widget-' + node.type.toLowerCase()} key={key}>{children}</div>;
}
export const SafeWidget = memo(function SafeWidget({ widget, state, itemId }: { widget: unknown; state: AgentMessageState; itemId: string }) {
  const tree = useMemo(() => sanitizeWidget(widget), [widget]);
  return <div className="ai-card">{render(tree, state, itemId, 'root')}</div>;
});
