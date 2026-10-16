import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { access, mkdtemp, readdir, realpath, rm, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, isAbsolute, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

export async function findCodexRuntime(env = process.env) {
  const executable = process.platform === 'win32' ? 'codex.exe' : 'codex';
  const candidates = [];
  if (env.CODEX_RUNTIME_PATH) candidates.push(env.CODEX_RUNTIME_PATH);
  if (process.platform === 'win32' && env.LOCALAPPDATA) {
    const directory = join(env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
    try {
      const entries = await Promise.all((await readdir(directory)).map(async name => { const path = join(directory, name, executable); try { return { path, time: (await stat(path)).mtimeMs }; } catch { return null; } }));
      candidates.push(...entries.filter(Boolean).sort((a, b) => b.time - a.time).map(item => item.path));
    } catch { /* The standalone CLI may still be installed on PATH. */ }
  }
  for (const directory of (env.PATH || env.Path || '').split(delimiter).filter(Boolean)) candidates.push(join(directory, executable));
  for (const candidate of candidates) { try { await access(candidate, constants.X_OK); if ((await stat(candidate)).isFile()) return await realpath(candidate); } catch { /* Continue discovery. */ } }
  return null;
}

export function allowedAgentRequest(req) {
  const host = req.headers.host || '';
  return req.method === 'POST' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) && req.headers.origin === 'http://' + host && req.headers['content-type'] === 'application/json';
}

export async function validateAgentConnection(payload) {
  if (typeof payload.cwd !== 'string' || !isAbsolute(payload.cwd)) throw Error('Isi path folder project yang absolut.');
  const cwd = await realpath(payload.cwd).catch(() => { throw Error('Folder project tidak ditemukan.'); });
  if (!(await stat(cwd)).isDirectory()) throw Error('Path project harus berupa folder.');
  const url = new URL(payload.baseUrl);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) throw Error('Alamat gateway tidak valid.');
  if (!payload.responsesConfirmed) throw Error('Konfirmasikan dukungan Responses API terlebih dahulu.');
  if (typeof payload.key !== 'string' || payload.key.length > 4096 || /[\r\n]/.test(payload.key)) throw Error('API key tidak valid.');
  if (typeof payload.model !== 'string' || !payload.model.trim() || payload.model.length > 160) throw Error('Pilih model terlebih dahulu.');
  return { cwd, baseUrl: url.toString().replace(/\/$/, ''), key: payload.key, model: payload.model.trim(), sandbox: payload.sandbox === 'workspace-write' ? 'workspace-write' : 'read-only' };
}

// A private app-server instance per browser session. No existing Codex accounts,
// plugins, or global configuration are read or modified by this bridge.
export class CodexAgentSession {
  constructor(child, options, home) {
    this.child = child; this.options = options; this.home = home;
    this.id = randomUUID(); this.pending = new Map(); this.approvals = new Map();
    this.sequence = 0; this.threadId = ''; this.turnId = ''; this.sink = null; this.closed = false;
    this.busy = false; this.touched = Date.now();
    this.lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    this.lines.on('line', line => { try { this.receive(JSON.parse(line)); } catch { /* Ignore non-protocol output. */ } });
    child.stderr.resume(); // Never log payloads, command output, or credentials.
    child.on('error', () => this.fail('Codex runtime gagal dijalankan.'));
    child.on('exit', () => this.fail('Codex runtime berhenti. Hubungkan ulang.'));
  }
  clean(value) {
    if (typeof value === 'string') return this.options.key ? value.split(this.options.key).join('[REDACTED]') : value;
    if (Array.isArray(value)) return value.map(item => this.clean(item));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, this.clean(item)]));
    return value;
  }
  emit(value) { if (this.sink) this.sink(this.clean(value)); }
  write(value) { if (this.closed || !this.child.stdin.writable) throw Error('Codex runtime tidak terhubung.'); this.child.stdin.write(JSON.stringify(value) + '\n'); }
  rpc(method, params, timeoutMs = 30000) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(Error('Codex runtime tidak merespons.')); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.write({ id, method, params }); } catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  receive(message) {
    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(message.id); if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(message.id);
      if (message.error) pending.reject(Error(this.clean(String(message.error.message || 'Permintaan Codex gagal.')))); else pending.resolve(message.result);
      return;
    }
    const p = message.params || {};
    if (message.id !== undefined) {
      if (['item/commandExecution/requestApproval', 'item/fileChange/requestApproval'].includes(message.method)) {
        this.approvals.set(String(message.id), message.id);
        this.emit({ type: 'approval', id: String(message.id), kind: message.method, details: p });
      } else {
        // Unknown permission/interaction requests must not become implicit approval.
        this.write({ id: message.id, error: { code: -32601, message: 'This client does not support this interaction yet.' } });
        this.emit({ type: 'notice', text: 'Runtime meminta interaksi yang belum didukung client ini.' });
      }
      return;
    }
    if (p.threadId && this.threadId && p.threadId !== this.threadId) return;
    switch (message.method) {
      case 'turn/started': this.turnId = p.turn?.id || ''; break;
      case 'item/agentMessage/delta': this.emit({ type: 'text', itemId: p.itemId, delta: p.delta || '' }); break;
      case 'item/commandExecution/outputDelta': this.emit({ type: 'output', itemId: p.itemId, delta: p.delta || '' }); break;
      case 'item/started': case 'item/completed':
        if (['commandExecution', 'fileChange', 'mcpToolCall', 'webSearch', 'plan'].includes(p.item?.type)) this.emit({ type: 'item', item: p.item });
        if (message.method === 'item/completed' && p.item?.type === 'agentMessage') this.emit({ type: 'message', itemId: p.item.id, text: p.item.text || '' });
        break;
      case 'turn/diff/updated': this.emit({ type: 'diff', diff: p.diff || '' }); break;
      case 'turn/plan/updated': this.emit({ type: 'plan', explanation: p.explanation, plan: p.plan || [] }); break;
      case 'serverRequest/resolved': this.approvals.delete(String(p.requestId)); this.emit({ type: 'resolved', id: String(p.requestId) }); break;
      case 'error': if (!p.willRetry) this.emit({ type: 'error', text: p.error?.message || 'Permintaan agent gagal.' }); break;
      case 'turn/completed':
        this.busy = false; this.turnId = ''; this.approvals.clear();
        this.emit({ type: 'done', status: p.turn?.status, error: p.turn?.error?.message }); this.sink = null; break;
    }
  }
  async initialize() {
    await this.rpc('initialize', { clientInfo: { name: 'sakelar_custom_client', title: 'Sakelar Custom Client', version: '0.3.0' } });
    this.write({ method: 'initialized', params: {} });
    const result = await this.rpc('thread/start', { model: this.options.model, modelProvider: 'custom_gateway', cwd: this.options.cwd, sandbox: this.options.sandbox, approvalPolicy: 'on-request', ephemeral: true });
    this.threadId = result.thread.id;
  }
  async turn(text, sink, effort, planOnly = false) {
    if (this.busy) throw Error('Agent masih bekerja. Hentikan atau tunggu jawaban selesai.');
    this.busy = true; this.stopRequested = false; this.sink = sink; this.touched = Date.now();
    try {
      const sandboxPolicy = planOnly || this.options.sandbox !== 'workspace-write' ? { type: 'readOnly', networkAccess: false } : { type: 'workspaceWrite', writableRoots: [this.options.cwd], networkAccess: false };
      const result = await this.rpc('turn/start', { threadId: this.threadId, input: [{ type: 'text', text: planOnly ? 'Plan only. Explain your proposed steps; do not make changes.\n\n' + text : text }], sandboxPolicy, approvalPolicy: planOnly ? 'never' : 'on-request', ...(effort ? { effort } : {}) });
      if (this.busy) this.turnId = result.turn.id;
      if (this.stopRequested && this.turnId) await this.rpc('turn/interrupt', { threadId: this.threadId, turnId: this.turnId }, 5000);
    } catch (error) { this.busy = false; this.sink = null; throw error; }
  }
  approve(id, accept) {
    const requestId = this.approvals.get(id);
    if (requestId === undefined) throw Error('Permintaan izin sudah tidak aktif.');
    this.write({ id: requestId, result: { decision: accept ? 'accept' : 'decline' } });
    this.approvals.delete(id); this.emit({ type: 'resolved', id }); this.touched = Date.now();
  }
  async interrupt() {
    this.stopRequested = true;
    for (const id of [...this.approvals.keys()]) this.approve(id, false);
    if (this.turnId) await this.rpc('turn/interrupt', { threadId: this.threadId, turnId: this.turnId }, 5000);
  }
  fail(text) {
    if (this.closed) return;
    this.closed = true; this.busy = false;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(Error(text)); }
    this.pending.clear(); this.approvals.clear(); this.emit({ type: 'error', text }); this.emit({ type: 'done', status: 'failed' }); this.sink = null;
  }
  async close() {
    try { await this.interrupt(); } catch { /* Process may have exited. */ }
    this.fail('Sesi agent ditutup.'); this.lines.close();
    if (this.child.pid && this.child.exitCode === null) {
      if (process.platform === 'win32') {
        const killer = spawn(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(this.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        await new Promise(resolve => { killer.on('exit', resolve); killer.on('error', resolve); });
      } else { try { process.kill(-this.child.pid, 'SIGTERM'); } catch { this.child.kill(); } }
    }
    const target = resolve(this.home);
    if (target.startsWith(resolve(tmpdir()) + sep) && target.split(sep).at(-1).startsWith('sakelar-agent-')) await rm(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 }).catch(() => {});
  }
}

export async function createCodexAgent(options, executable) {
  const home = await mkdtemp(join(tmpdir(), 'sakelar-agent-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(path|systemroot|windir|comspec|temp|tmp|userprofile|localappdata|appdata|homedrive|homepath|home|lang|lc_all|programfiles|programfiles\(x86\))$/i.test(name)));
  env.CODEX_HOME = home;
  if (options.key) env.SAKELAR_AGENT_API_KEY = options.key;
  const config = {
    model_provider: 'custom_gateway', model: options.model,
    'model_providers.custom_gateway.name': 'Custom gateway',
    'model_providers.custom_gateway.base_url': options.baseUrl,
    'model_providers.custom_gateway.wire_api': 'responses',
    'model_providers.custom_gateway.requires_openai_auth': false,
    ...(options.key ? { 'model_providers.custom_gateway.env_key': 'SAKELAR_AGENT_API_KEY' } : {}),
    sandbox_mode: options.sandbox, approval_policy: 'on-request',
    'shell_environment_policy.exclude': ['SAKELAR_AGENT_API_KEY'],
    'sandbox_workspace_write.network_access': false, web_search: 'disabled',
  };
  const args = Object.entries(config).flatMap(([name, value]) => ['-c', name + '=' + JSON.stringify(value)]);
  args.push('app-server', '--listen', 'stdio://');
  const child = spawn(executable, args, { cwd: options.cwd, env, windowsHide: true, shell: false, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
  const session = new CodexAgentSession(child, options, home);
  try { await session.initialize(); return session; } catch (error) { await session.close(); throw error; }
}

export function codexAgentBridge({ findRuntime = findCodexRuntime, createSession = createCodexAgent } = {}) {
  const sessions = new Map(); let opening = 0;
  return {
    name: 'codex-local-agent',
    configureServer(server) {
      const cleanup = setInterval(() => { for (const [id, session] of sessions) if (!session.busy && Date.now() - session.touched > 15 * 60 * 1000) { sessions.delete(id); void session.close(); } }, 60000);
      cleanup.unref();
      server.httpServer?.once('close', () => { clearInterval(cleanup); for (const session of sessions.values()) void session.close(); sessions.clear(); });
      server.middlewares.use('/__client/agent', async (req, res) => {
        const json = (status, value) => { if (!res.headersSent) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); } };
        res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
        if (!allowedAgentRequest(req)) { json(403, { error: 'Local origin required.' }); return; }
        let session;
        try {
          let raw = ''; for await (const chunk of req) { raw += chunk.toString(); if (Buffer.byteLength(raw) > 512 * 1024) { json(413, { error: 'Permintaan terlalu besar.' }); return; } }
          const payload = JSON.parse(raw);
          if (payload.action === 'status') { json(200, { available: !!(await findRuntime()), platform: process.platform }); return; }
          if (payload.action === 'connect') {
            if (sessions.size + opening >= 4) { json(429, { error: 'Tutup sesi agent lain terlebih dahulu.' }); return; }
            opening++;
            try {
              const options = await validateAgentConnection(payload); const runtime = await findRuntime();
              if (!runtime) throw Error('Codex CLI belum ditemukan. Instal Codex CLI atau atur CODEX_RUNTIME_PATH pada server lokal.');
              session = await createSession(options, runtime); sessions.set(session.id, session);
              json(200, { sessionId: session.id, threadId: session.threadId, cwd: options.cwd });
            } finally { opening--; }
            return;
          }
          session = sessions.get(payload.sessionId);
          if (!session || session.closed) { json(404, { error: 'Sesi agent berakhir. Hubungkan ulang.' }); return; }
          session.touched = Date.now();
          if (payload.action === 'close') { sessions.delete(session.id); await session.close(); json(200, { ok: true }); return; }
          if (payload.action === 'stop') { await session.interrupt(); json(200, { ok: true }); return; }
          if (payload.action === 'approve') {
            if (typeof payload.requestId !== 'string' || typeof payload.accept !== 'boolean') throw Error('Keputusan izin tidak valid.');
            session.approve(payload.requestId, payload.accept); json(200, { ok: true }); return;
          }
          if (payload.action !== 'turn' || typeof payload.text !== 'string' || !payload.text.trim() || payload.text.length > 100000) throw Error('Pesan agent tidak valid.');
          if (session.busy) { json(409, { error: 'Agent masih bekerja.' }); return; }
          res.setHeader('Content-Type', 'application/x-ndjson'); res.flushHeaders();
          const sink = event => { if (!res.destroyed) res.write(JSON.stringify(event) + '\n'); if (event.type === 'done') res.end(); };
          res.once('close', () => { if (!res.writableEnded) { session.sink = null; void session.interrupt().catch(() => session.close()); } });
          await session.turn(payload.text, sink, ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(payload.effort) ? payload.effort : undefined, payload.planOnly === true);
        } catch (error) {
          const text = session ? session.clean(String(error.message || 'Agent gagal.')) : 'Koneksi agent gagal. Periksa folder, runtime, dan konfigurasi Responses API.';
          if (res.headersSent) { if (!res.destroyed) { res.write(JSON.stringify({ type: 'error', text }) + '\n'); res.write('{"type":"done","status":"failed"}\n'); res.end(); } }
          else json(400, { error: text });
        }
      });
    },
  };
}
