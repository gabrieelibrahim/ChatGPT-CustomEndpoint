import { existsSync, readdirSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
// Optional machine-specific toolchain paths. Never version or bundle this file.
const localEnvironment = join(root, '.env.desktop.local');
if (existsSync(localEnvironment)) process.loadEnvFile(localEnvironment);
if (process.env.CARGO_HOME) process.env.PATH = join(process.env.CARGO_HOME, 'bin') + delimiter + process.env.PATH;
if (process.platform === 'win32') {
  const vswhere = join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  if (existsSync(vswhere)) {
    const installation = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { encoding: 'utf8', windowsHide: true }).trim();
    const developerCommand = join(installation, 'Common7', 'Tools', 'VsDevCmd.bat');
    if (installation && existsSync(developerCommand)) {
      const environment = execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${developerCommand}" -no_logo -arch=x64 -host_arch=x64 >nul && set"`], { encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true });
      for (const line of environment.split(/\r?\n/)) { const equals = line.indexOf('='); if (equals > 0) process.env[line.slice(0, equals)] = line.slice(equals + 1); }
    }
  }
}
if (process.platform === 'win32' && process.env.DESKTOP_WINDOWS_SDK) {
  const sdk = process.env.DESKTOP_WINDOWS_SDK;
  const version = readdirSync(join(sdk, 'Include')).filter(name => /^10\.\d+\.\d+\.\d+$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
  if (!version) throw Error('No Windows SDK headers found in DESKTOP_WINDOWS_SDK');
  process.env.WindowsSdkDir = sdk + '\\';
  process.env.WindowsSDKVersion = version + '\\';
  process.env.WindowsSdkBinPath = join(sdk, 'bin') + '\\';
  process.env.WindowsSdkVerBinPath = join(sdk, 'bin', version) + '\\';
  process.env.UniversalCRTSdkDir = sdk + '\\';
  process.env.UCRTVersion = version;
  process.env.INCLUDE = ['ucrt', 'shared', 'um', 'winrt', 'cppwinrt'].map(name => join(sdk, 'Include', version, name)).join(';') + ';' + (process.env.INCLUDE || '');
  process.env.LIB = [join(sdk, 'um', 'x64'), join(sdk, 'ucrt', 'x64'), process.env.LIB || ''].join(';');
  process.env.PATH = join(sdk, 'bin', version, 'x64') + ';' + process.env.PATH;
}
const cli = join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const args = process.argv.slice(2), cargo = args[0] === '--cargo';
const child = spawn(cargo ? 'cargo' : process.execPath, cargo ? args.slice(1) : [cli, ...args], { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error('Tauri could not start:', error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
