import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readSigningIdentity } from './androidSigning.mjs';

export function releaseArguments(tag, apk, checksum, notes) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw Error('Use a stable tag such as v1.2.0.');
  if (basename(apk) !== 'SuperGPT.apk' || basename(checksum) !== 'SHA256SUMS.txt') throw Error('Release assets must be SuperGPT.apk and SHA256SUMS.txt.');
  return ['release', 'create', tag, apk, checksum, '--repo', 'gabrieelibrahim/SuperGPT', '--title', `SuperGPT ${tag}`, '--notes-file', notes, '--verify-tag', '--prerelease=false', '--latest'];
}
export function validateApkMetadata(tag, badging) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw Error('Invalid stable release tag.');
  const version = /versionName='([^']+)'/.exec(badging)?.[1];
  if (version !== tag.slice(1)) throw Error('APK versionName must match the release tag.');
  if (!/package: name='id\.sakelar\.client'/.test(badging)) throw Error('Only the production Android package may be released.');
  if (/^application-debuggable\b/m.test(badging)) throw Error('Debuggable APKs cannot be published.');
  if (!/native-code:.*'arm64-v8a'/.test(badging)) throw Error('Release APK must support ARM64.');
}
export function validateApkSignature(certificateReport, fingerprint) {
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw Error('Invalid pinned release certificate.');
  const digests = [...certificateReport.matchAll(/^Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9:]+)\s*$/gm)].map(match => match[1].replaceAll(':', '').toLowerCase());
  if (digests.length !== 1 || digests[0] !== fingerprint || /certificate DN:.*Android Debug/i.test(certificateReport)) throw Error('APK is not signed by the permanent SuperGPT release key.');
}
export function validateStartupReport(report, apkSha256) {
  if (report.packageName !== 'id.sakelar.client' || report.sha256 !== apkSha256 || report.passed !== true || report.processAlive !== true || report.uiRendered !== true || report.failure) {
    throw Error('A successful Android startup report for this exact final APK is required. Run npm run test:android-release first.');
  }
}
function main() {
  const args = process.argv.slice(2), value = key => args[args.indexOf(key) + 1];
  if (!args.includes('--tag') || !args.includes('--apk') || !args.includes('--notes') || !args.includes('--startup-report')) throw Error('Usage: node scripts/publishAndroidRelease.mjs --tag v1.2.0 --apk path --notes release.md --startup-report report.json [--dry-run]');
  const tag = value('--tag'), source = resolve(value('--apk')), notes = resolve(value('--notes'));
  validateStartupReport(JSON.parse(readFileSync(resolve(value('--startup-report')), 'utf8')), createHash('sha256').update(readFileSync(source)).digest('hex'));
  const root = fileURLToPath(new URL('../', import.meta.url));
  const env = join(root, '.env.mobile.local'); if (existsSync(env)) process.loadEnvFile(env);
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT; if (!sdk) throw Error('ANDROID_HOME is required for APK verification.');
  const versions = readdirSync(join(sdk, 'build-tools')).filter(name => /^\d+\.\d+\.\d+$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const tools = join(sdk, 'build-tools', versions.at(-1) || '');
  const windows = process.platform === 'win32';
  const badging = execFileSync(join(tools, windows ? 'aapt.exe' : 'aapt'), ['dump', 'badging', source], { encoding: 'utf8', windowsHide: true });
  validateApkMetadata(tag, badging);
  const certificates = execFileSync(process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', windows ? 'java.exe' : 'java') : 'java', ['-jar', join(tools, 'lib/apksigner.jar'), 'verify', '--verbose', '--print-certs', source], { encoding: 'utf8', windowsHide: true });
  validateApkSignature(certificates, readSigningIdentity(root).sha256);
  execFileSync('git', ['rev-parse', '--verify', `${tag}^{commit}`], { cwd: root, stdio: 'pipe', windowsHide: true });
  const folder = mkdtempSync(join(tmpdir(), 'supergpt-release-'));
  const apk = join(folder, 'SuperGPT.apk'), checksum = join(folder, 'SHA256SUMS.txt');
  copyFileSync(source, apk);
  writeFileSync(checksum, createHash('sha256').update(readFileSync(apk)).digest('hex') + '  SuperGPT.apk\n');
  const command = releaseArguments(tag, apk, checksum, notes);
  if (args.includes('--dry-run')) { console.log(`Verified ${tag}. Prepared SuperGPT.apk and SHA256SUMS.txt at ${folder}. Nothing published.`); return; }
  execFileSync('gh', command, { cwd: root, stdio: 'inherit', windowsHide: true });
  const release = JSON.parse(execFileSync('gh', ['api', `repos/gabrieelibrahim/SuperGPT/releases/tags/${tag}`], { encoding: 'utf8', windowsHide: true }));
  const asset = release.assets?.find(item => item.name === 'SuperGPT.apk');
  if (release.draft || release.prerelease || !asset || asset.digest !== 'sha256:' + createHash('sha256').update(readFileSync(apk)).digest('hex')) throw Error('Published release verification failed. Inspect GitHub before announcing it.');
  console.log(release.html_url);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : 'Release failed.'); process.exitCode = 1; }
}
