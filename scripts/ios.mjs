import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const [action, ...args] = process.argv.slice(2);
if (!['doctor', 'init', 'dev', 'build'].includes(action)) {
  console.error('Gunakan ios:doctor, ios:init, ios:dev, atau ios:build.'); process.exit(1);
}
// Exit before loading private environment files or invoking any build tool on Windows.
if (process.platform !== 'darwin') {
  console.error('Aplikasi iOS native memerlukan macOS dan Xcode. Dari Windows, gunakan source web melalui Safari setelah tersedia di HTTPS. Tidak ada build yang dijalankan.');
  process.exit(1);
}
if (action === 'doctor') {
  const probes = [
    ['Xcode', 'xcodebuild', ['-version']],
    ['iPhone SDK', 'xcrun', ['--sdk', 'iphoneos', '--show-sdk-version']],
    ['Rust', 'rustc', ['--version']],
    ['Cargo', 'cargo', ['--version']],
    ['Rust targets', 'rustup', ['target', 'list', '--installed']],
    ['CocoaPods', 'pod', ['--version']],
  ];
  let failed = false;
  for (const [label, cmd, params] of probes) {
    const result = spawnSync(cmd, params, { encoding: 'utf8', timeout: 15000 });
    const ok = result.status === 0;
    console.log(label + ': ' + (ok ? result.stdout.trim() : 'belum tersedia'));
    if (!ok) failed = true;
    if (label === 'Rust targets' && ok && !result.stdout.includes('aarch64-apple-ios')) {
      console.log('Target iPhone belum terpasang: rustup target add aarch64-apple-ios'); failed = true;
    }
  }
  console.log('Pemeriksaan ini tidak melakukan compile, signing, atau rilis.');
  process.exit(failed ? 1 : 0);
}
const localEnvironment = join(root, '.env.ios.local');
if (existsSync(localEnvironment)) process.loadEnvFile(localEnvironment);
const cli = join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
if (!existsSync(cli)) { console.error('Jalankan npm ci terlebih dahulu pada Mac.'); process.exit(1); }
const child = spawn(process.execPath, [cli, 'ios', action, ...args], { cwd: root, env: process.env, stdio: 'inherit' });
child.on('error', () => { console.error('Tauri iOS tidak dapat dimulai. Periksa Node, Xcode, dan dependensi pada Mac.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
