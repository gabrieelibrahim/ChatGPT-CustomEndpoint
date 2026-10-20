import { MCPServerStreamableHttp } from '@openai/agents';

export function searchSources(result) {
  const sources = [], add = (url, title) => { try { const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || sources.some(value => value.url === parsed.href)) return; sources.push({ url: parsed.href, title: String(title || parsed.hostname).slice(0, 240) }); } catch { /* Not a citation. */ } };
  for (const item of result?.structuredContent?.results || []) add(item.url, item.title);
  for (const part of (Array.isArray(result) ? result : result?.content) || []) if (part.type === 'text') {
    let title = '';
    for (const line of String(part.text).split('\n')) {
      if (/^Title:\s*/i.test(line)) title = line.replace(/^Title:\s*/i, '');
      if (/^URL:\s*/i.test(line)) add(line.replace(/^URL:\s*/i, '').trim(), title);
    }
  }
  return sources.slice(0, 10);
}
export async function searchWeb(query, signal, url = process.env.SUPERGPT_WEB_MCP_URL || 'https://mcp.exa.ai/mcp', timeoutSeconds = 25) {
  const server = new MCPServerStreamableHttp({ name: 'web_search', url, clientSessionTimeoutSeconds: timeoutSeconds, timeout: timeoutSeconds * 1000, logger: { debug() {}, info() {}, warn() {}, error() {} } });
  const cancel = () => { void server.close().catch(() => {}); }; signal?.addEventListener('abort', cancel, { once: true });
  try {
    signal?.throwIfAborted(); await server.connect(); signal?.throwIfAborted();
    const raw = await server.callTool('web_search_exa', { query, numResults: 5 }, undefined, { signal });
    const result = Array.isArray(raw) ? { content: raw } : raw;
    const sources = searchSources(result);
    if (result.isError || (!sources.length && result.content?.some(part => part.type === 'text' && /^You've hit Exa's free MCP rate limit/i.test(part.text)))) throw Object.assign(Error('Kuota pencarian Exa tercapai.'), { code: 'WEB_SEARCH_QUOTA' });
    return { result, sources };
  } finally { signal?.removeEventListener('abort', cancel); await server.close().catch(() => {}); }
}
