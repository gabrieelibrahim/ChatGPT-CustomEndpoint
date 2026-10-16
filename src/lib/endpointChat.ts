import { normalizeBaseUrl, type EndpointProfile } from './endpointProfiles';
import { providerFetch, providerStatusError } from './providerTransport';
export type ProviderMessage = { role: 'user' | 'assistant'; text: string };

export async function streamEndpointChat(profile: EndpointProfile, key: string, model: string, messages: ProviderMessage[], signal: AbortSignal, onText: (text: string) => void, reasoningEffort?: string): Promise<void> {
  if (profile.auth === 'bearer' && !key.trim()) throw Error('API key sesi ini belum tersedia. Masukkan ulang di Custom Endpoint.');
  const response = await providerFetch(normalizeBaseUrl(profile.baseUrl) + '/chat/completions', profile.auth === 'bearer' ? key : '', signal, {
    model, stream: true, messages: messages.filter(message => message.text).map(message => ({ role: message.role, content: message.text })),
    ...(profile.sendReasoning && reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
  });
  if (!response.ok) throw providerStatusError(response.status);
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text) throw Error('Penyedia tidak mengirim jawaban teks yang dikenali.');
    onText(text); return;
  }
  if (!response.body) throw Error('Penyedia mengirim respons kosong.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', answer = '', done = false;
  function event(block: string) {
    const raw = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n').trim();
    if (!raw) return;
    if (raw === '[DONE]') { done = true; return; }
    let json;
    try { json = JSON.parse(raw); } catch { throw Error('Respons streaming penyedia tidak valid.'); }
    if (json.error) throw Error('Penyedia menghentikan jawaban. Periksa model, kuota, dan izin API key.');
    const delta = json.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') { answer += delta; if (answer.length > 2 * 1024 * 1024) throw Error('Jawaban penyedia terlalu panjang.'); onText(answer); }
  }
  try {
    while (!done) {
      const result = await reader.read();
      buffer += decoder.decode(result.value, { stream: !result.done });
      // Normalize only complete lines; a chunk can end in the middle of CRLF.
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary: number;
      while (!done && (boundary = buffer.indexOf('\n\n')) >= 0) { const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2); event(block); }
      if (buffer.length > 2 * 1024 * 1024) throw Error('Respons streaming penyedia terlalu besar.');
      if (result.done) { if (!done && buffer.trim()) event(buffer); break; }
    }
    if (!answer.trim()) throw Error('Penyedia tidak mengirim jawaban teks. Model ini mungkin memerlukan protokol lain.');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
