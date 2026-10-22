import type { AgentItem } from './mainClient';
import { activityLabels, type ToolActivity } from './toolActivity';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function safeAgentItem(value: unknown): AgentItem | null {
  if (!object(value) || typeof value.id !== 'string' || !value.id || value.id.length > 200) return null;
  if (value.type === 'tool_activity' && object(value.activity)) {
    const a = value.activity;
    if (typeof a.name !== 'string' || !a.name || a.name.length > 300 || typeof a.status !== 'string' || !Object.hasOwn(activityLabels, a.status) || typeof a.startedAt !== 'number' || !Number.isFinite(a.startedAt) || a.startedAt < 0) return null;
    return { id: value.id, type: 'tool_activity', activity: { name: a.name, status: a.status as ToolActivity['status'], startedAt: a.startedAt, ...(typeof a.endedAt === 'number' && Number.isFinite(a.endedAt) && a.endedAt >= a.startedAt ? { endedAt: a.endedAt } : {}) } };
  }
  if (value.type === 'widget') return object(value.widget) ? { id: value.id, type: 'widget', widget: value.widget as AgentItem['widget'] } : null;
  if (value.type === 'structured_input') {
    if (!Array.isArray(value.inputs) || value.inputs.length > 12) return null;
    const inputs: NonNullable<AgentItem['inputs']> = [];
    for (const input of value.inputs) {
      if (!object(input) || typeof input.id !== 'string' || input.id.length > 200 || typeof input.question !== 'string' || input.question.length > 4000) return null;
      const options = Array.isArray(input.options) ? input.options.filter(object).filter(option => typeof option.value === 'string' && option.value.length <= 1000).slice(0, 20).map(option => ({ value: option.value as string })) : undefined;
      inputs.push({ id: input.id, question: input.question, options });
    }
    return { id: value.id, type: 'structured_input', status: value.status === 'pending' ? 'pending' : 'answered', inputs };
  }
  if (value.type === 'generated_image' && object(value.image) && typeof value.image.url === 'string') {
    try { const url = new URL(value.image.url); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null; return { id: value.id, type: 'generated_image', image: { url: url.href } }; } catch { return null; }
  }
  return null;
}
