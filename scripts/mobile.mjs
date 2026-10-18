import { existsSync, mkdirSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const name of ['.env.desktop.local', '.env.mobile.local']) {
  const file = join(root, name);
  if (existsSync(file)) process.loadEnvFile(file);
}
// Keep the compatible debug package/signature without shipping Rust's enormous
// DWARF/symbol tables. Explicit environment overrides still allow full debugging.
if (process.argv.includes('android') && process.argv.includes('build') && process.argv.includes('--debug')) {
  process.env.CARGO_PROFILE_DEV_DEBUG ??= '0';
  process.env.CARGO_PROFILE_DEV_STRIP ??= 'symbols';
}
if (process.env.CARGO_HOME) process.env.PATH = join(process.env.CARGO_HOME, 'bin') + delimiter + process.env.PATH;
if (process.env.JAVA_HOME) process.env.PATH = join(process.env.JAVA_HOME, 'bin') + delimiter + process.env.PATH;
// Windows JDK NIO pipes use short Unix-domain socket paths. The default TEMP
// path can exceed their limit and Gradle then reports a loopback connection error.
if (process.platform === 'win32') {
  const socketDirectory = join(root, '.java-tmp');
  mkdirSync(socketDirectory, { recursive: true });
  const options = [process.env.JAVA_TOOL_OPTIONS || ''];
  if (!options[0].includes('-Djdk.net.unixdomain.tmpdir=')) options.push(`-Djdk.net.unixdomain.tmpdir="${socketDirectory}"`);
  if (!options[0].includes('-Djava.net.preferIPv4Stack=')) options.push('-Djava.net.preferIPv4Stack=true');
  process.env.JAVA_TOOL_OPTIONS = options.filter(Boolean).join(' ');
}
// Cargo build scripts still compile for the Windows host during Android builds.
// Reuse the MSVC/Windows SDK bootstrap as well as the Android environment above.
const child = spawn(process.execPath, [join(root, 'scripts/desktop.mjs'), ...process.argv.slice(2)], {cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
child.on('error', error => {console.error(error.message);process.exitCode=1;});
child.on('exit', code => {process.exitCode=code??1;});
