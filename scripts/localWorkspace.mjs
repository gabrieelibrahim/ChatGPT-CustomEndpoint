import { spawn } from 'node:child_process';
import { realpath, stat, readdir, readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { hostname } from 'node:os';

async function capture(executable, args, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let text = ''; const timer = setTimeout(() => { child.kill(); reject(Error('Operasi lokal melewati batas waktu.')); }, timeout);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => { text += chunk; if (text.length > 1024 * 1024) { child.kill(); reject(Error('Output terlalu besar.')); } });
    child.on('error', () => { clearTimeout(timer); reject(Error('Aplikasi lokal tidak tersedia.')); });
    child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve(text.trim()) : reject(Error('Operasi lokal dibatalkan atau gagal.')); });
  });
}

export async function workspaceInfo(value) {
  if (typeof value !== 'string' || !isAbsolute(value)) throw Error('Masukkan path folder absolut.');
  const path = await realpath(value); if (!(await stat(path)).isDirectory()) throw Error('Path harus berupa folder.');
  const name = path.split(/[\\/]/).filter(Boolean).at(-1) || path;
  let branch = null, changes = null;
  try { branch = await capture('git', ['-C', path, '-c', 'core.fsmonitor=false', 'branch', '--show-current']); changes = await capture('git', ['-C', path, '-c', 'core.fsmonitor=false', 'status', '--short', '--untracked-files=no']); } catch { /* Git is optional. */ }
  return { path, name, branch, changes };
}

export async function chooseLocalDirectory() {
  let path;
  if (process.platform === 'win32') {
    const script = "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding; Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Choose project folder'; $dialog.ShowNewFolderButton = $true; if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.SelectedPath | ConvertTo-Json -Compress } else { 'null' }; $dialog.Dispose()";
    path = JSON.parse(await capture(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-STA', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], 300000));
  } else if (process.platform === 'darwin') path = await capture('osascript', ['-e', 'POSIX path of (choose folder with prompt "Choose project folder")'], 300000);
  else path = await capture('zenity', ['--file-selection', '--directory', '--title=Choose project folder'], 300000);
  return path ? workspaceInfo(path) : null;
}

export async function workspaceFiles(cwd, query = '') {
  const root = await realpath(cwd); const files = []; let visited = 0;
  async function scan(path, depth) {
    if (depth > 8 || visited >= 3000) return;
    for (const entry of await readdir(path, { withFileTypes: true }).catch(() => [])) {
      if (visited++ >= 3000) break;
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', 'vendor'].includes(entry.name) || entry.isSymbolicLink()) continue;
      const next = join(path, entry.name);
      if (entry.isDirectory()) await scan(next, depth + 1);
      else if (entry.isFile()) { const name = relative(root, next); if (name.toLowerCase().includes(String(query).toLowerCase())) files.push(name); }
    }
  }
  await scan(root, 0); return { files, limited: visited >= 3000 };
}

export async function workspaceFile(cwd, name) {
  if (typeof name !== 'string' || isAbsolute(name)) throw Error('Path file tidak valid.');
  const root = await realpath(cwd), path = await realpath(join(root, name));
  const difference = relative(root, path);
  if (!difference || difference.startsWith('..' + sep) || difference === '..' || isAbsolute(difference)) throw Error('File harus berada di folder project.');
  const info = await stat(path); if (!info.isFile() || info.size > 512 * 1024) throw Error('Preview hanya mendukung file teks hingga 512 KB.');
  const bytes = await readFile(path); if (bytes.includes(0)) throw Error('File biner belum mendukung preview teks.');
  return { name: difference, text: bytes.toString('utf8') };
}

export function localComputerInfo() { return { platform: process.platform, name: hostname(), execution: 'local' }; }
export async function workspaceGit(cwd) { const project = await workspaceInfo(cwd); const diff = await capture('git', ['-C', project.path, '-c', 'core.fsmonitor=false', 'diff', '--no-ext-diff', '--no-textconv', 'HEAD']).catch(() => 'Git diff tidak tersedia; repository mungkin belum memiliki commit.'); return { ...project, diff }; }
