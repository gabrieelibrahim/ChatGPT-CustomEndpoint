import { access, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { findCodexRuntime } from './codexAgentBridge.mjs';

export async function prepareDesktop() {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('Desktop v0.1.0 currently builds Windows x64.');
  const root = fileURLToPath(new URL('../', import.meta.url)), destination = join(root, 'src-tauri', 'runtime');
  if (existsSync(join(root, '.env.desktop.local'))) process.loadEnvFile(join(root, '.env.desktop.local'));
  const nodePath = process.env.DESKTOP_NODE_PATH || process.execPath;
  const runtime = await findCodexRuntime();
  if (!runtime) throw Error('Install the official Codex CLI or set CODEX_RUNTIME_PATH before packaging.');
  await mkdir(join(destination, 'agent'), { recursive: true });
  await mkdir(join(destination, 'codex'), { recursive: true });
  const manifest = { node: execFileSync(nodePath, ['--version'], { encoding: 'utf8', windowsHide: true }).trim(), codex: execFileSync(runtime, ['--version'], { encoding: 'utf8', windowsHide: true }).trim(), files: [] };
  async function copy(source, relative) {
    await copyFile(source, join(destination, relative));
    const sha256 = createHash('sha256').update(await readFile(source)).digest('hex');
    manifest.files.push({ name: relative.replaceAll('\\', '/'), sha256 });
  }
  await copy(nodePath, 'node.exe');
  for (const name of ['desktopAgentHost.mjs', 'codexAgentBridge.mjs', 'localWorkspace.mjs']) await copy(join(root, 'scripts', name), join('agent', name));
  const executables = ['codex.exe', 'codex-command-runner.exe', 'codex-windows-sandbox-setup.exe', 'codex-code-mode-host.exe'];
  for (const name of executables) {
    const source = join(dirname(runtime), name);
    try { await access(source); } catch { if (name === 'codex.exe') throw Error('Missing Codex executable'); continue; }
    await copy(source, join('codex', name));
  }
  // Runtime bundles contain executables and license notices only, never user profiles/configuration.
  const nodeLicense = join(dirname(nodePath), 'LICENSE');
  try { await copy(nodeLicense, 'NODE-LICENSE.txt'); } catch { throw Error('Node license not found beside node.exe.'); }
  const apacheLicense = join(root, 'node_modules', '@tauri-apps', 'cli', 'LICENSE_APACHE-2.0');
  try { await copy(apacheLicense, 'CODEX-LICENSE-APACHE-2.0.txt'); } catch {
    const names = await readdir(join(root, 'node_modules', '@tauri-apps', 'cli'));
    const name = names.find(name => /apache/i.test(name));
    if (!name) throw Error('Apache 2.0 license text is needed for Codex runtime redistribution.');
    await copy(join(root, 'node_modules', '@tauri-apps', 'cli', name), 'CODEX-LICENSE-APACHE-2.0.txt');
  }
  await writeFile(join(destination, 'NOTICE.txt'), 'Sakelar bundles Node.js (https://nodejs.org/) and the OpenAI Codex CLI runtime (https://github.com/openai/codex). Node includes its complete license notices. Codex CLI is licensed under Apache-2.0. No OpenAI account, token, cloud entitlement, or provider credential is bundled.\n');
  await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Prepared ${manifest.node} and ${manifest.codex}; ${manifest.files.length} runtime files, no user configuration.`);
  return destination;
}
if (process.argv[1] && basename(process.argv[1]) === 'prepareDesktop.mjs') await prepareDesktop();
