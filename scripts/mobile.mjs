import { existsSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const name of ['.env.desktop.local', '.env.mobile.local']) {
  const file = join(root, name);
  if (existsSync(file)) process.loadEnvFile(file);
}
if (process.env.CARGO_HOME) process.env.PATH = join(process.env.CARGO_HOME, 'bin') + delimiter + process.env.PATH;
if (process.env.JAVA_HOME) process.env.PATH = join(process.env.JAVA_HOME, 'bin') + delimiter + process.env.PATH;
// Cargo build scripts still compile for the Windows host during Android builds.
// Reuse the MSVC/Windows SDK bootstrap as well as the Android environment above.
const child = spawn(process.execPath, [join(root, 'scripts/desktop.mjs'), ...process.argv.slice(2)], {cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
child.on('error', error => {console.error(error.message);process.exitCode=1;});
child.on('exit', code => {process.exitCode=code??1;});
