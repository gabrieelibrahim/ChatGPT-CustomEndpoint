import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export function startupFailure({ pid, activity, ui, crash, packageName }) {
  if (crash.includes(`Process: ${packageName},`) || crash.includes(`Cmdline: ${packageName}`)) return 'The packaged app crashed during startup.';
  if (!/^\d+(?:\s+\d+)*$/.test(pid.trim())) return 'The app process exited during startup.';
  if (!activity.split('\n').some(line => /mResumedActivity|topResumedActivity/.test(line) && line.includes(packageName + '/'))) return 'The app is not the resumed activity.';
  if (!ui.includes('class="android.webkit.WebView"') || !/Open sidebar|text="Chat"|Pengaturan|Custom Endpoint/.test(ui)) return 'The actual chat/settings UI did not render.';
  if (/ERR_[A-Z_]+|Web page not available/.test(ui)) return 'The WebView showed a load error.';
  return '';
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  if (existsSync(join(root, '.env.mobile.local'))) process.loadEnvFile(join(root, '.env.mobile.local'));
  const args = process.argv.slice(2), value = key => args[args.indexOf(key) + 1];
  for (const key of ['--serial', '--apk', '--output']) if (!args.includes(key) || !value(key) || value(key).startsWith('--')) throw Error(`Required argument: ${key}`);
  const serial = value('--serial'), apk = resolve(value('--apk')), output = resolve(value('--output')), packageName = 'id.sakelar.client';
  const adb = process.env.ANDROID_HOME ? join(process.env.ANDROID_HOME, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb') : 'adb';
  const run = (...command) => execFileSync(adb, ['-s', serial, ...command], { encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  if (run('get-state').trim() !== 'device') throw Error('Select an attached, booted Android device explicitly.');
  mkdirSync(output, { recursive: true });
  console.log('Installing the actual release APK; existing app data is retained.');
  run('install', '-r', apk);
  run('shell', 'am', 'force-stop', packageName);
  const since = run('shell', "date '+%m-%d %H:%M:%S.000'").trim();
  writeFileSync(join(output, 'launch.txt'), run('shell', 'am', 'start', '-W', '-n', packageName + '/.MainActivity'));
  let pid = '';
  for (let i = 0; i < 10; i++) {
    try { pid = run('shell', 'pidof', packageName).trim(); } catch { pid = ''; }
    if (!pid) break;
    await delay(1500);
  }
  let ui = '';
  // Chromium may expose only the empty WebView on the first accessibility
  // query after a cold start. Require actual app controls within a bounded retry.
  for (let attempt = 0; pid && attempt < 5; attempt++) {
    run('shell', 'uiautomator', 'dump', '/sdcard/supergpt-startup-smoke.xml');
    ui = run('exec-out', 'cat', '/sdcard/supergpt-startup-smoke.xml');
    if (/Open sidebar|text="Chat"|Pengaturan|Custom Endpoint/.test(ui)) break;
    await delay(1500);
    try { pid = run('shell', 'pidof', packageName).trim(); } catch { pid = ''; }
  }
  const crash = run('logcat', '-b', 'crash', '-d', '-T', since);
  const activity = run('shell', 'dumpsys', 'activity', 'activities');
  writeFileSync(join(output, 'crash.txt'), crash);
  writeFileSync(join(output, 'activity.txt'), activity);
  writeFileSync(join(output, 'ui.xml'), ui);
  const failure = startupFailure({ pid, activity, ui, crash, packageName });
  const report = { serial, apk, sha256: createHash('sha256').update(readFileSync(apk)).digest('hex'), testedAt: new Date().toISOString(), packageName, processAlive: !!pid, uiRendered: !!ui && !failure, passed: !failure, failure };
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (failure) throw Error(failure + ' See the captured local report and crash log.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error instanceof Error ? error.message : 'Android startup test failed.'); process.exitCode = 1; });
