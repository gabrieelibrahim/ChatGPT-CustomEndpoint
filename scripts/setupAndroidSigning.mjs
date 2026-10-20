import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, constants, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomBytes, X509Certificate, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { signingPropertiesPath, readSigningProperties, readSigningIdentity } from './androidSigning.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const name of ['.env.desktop.local', '.env.mobile.local']) if (existsSync(join(root, name))) process.loadEnvFile(join(root, name));
function privateDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') {
    // Exact ACL: this Windows account and SYSTEM. No secret appears in command arguments.
    const command = "$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=New-Object System.Security.AccessControl.DirectorySecurity; $acl.SetAccessRuleProtection($true,$false); $acl.SetOwner($sid); foreach($id in @($sid,(New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')))){ $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($id,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $acl.AddAccessRule($rule) }; [System.IO.Directory]::SetAccessControl($env:SUPERGPT_SIGNING_DIR,$acl)";
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '$ErrorActionPreference="Stop"; ' + command], { env: { ...process.env, SUPERGPT_SIGNING_DIR: path }, stdio: 'pipe', windowsHide: true });
  } else chmodSync(path, 0o700);
}
function main() {
  const properties = signingPropertiesPath(), folder = dirname(properties), store = join(folder, 'supergpt-release.p12');
  const pinFile = join(root, 'config', 'android-release-signing.json');
  const keytool = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool') : 'keytool';
  if (existsSync(pinFile) && !existsSync(properties)) throw Error('A permanent release identity already exists. Restore its keystore/properties backup; key rotation is not automatic.');
  privateDirectory(folder);
  if (!existsSync(properties)) {
    if (existsSync(store)) throw Error('Keystore already exists without its properties. Restore the properties; the key will not be overwritten.');
    const password = randomBytes(48).toString('base64url');
    execFileSync(keytool, ['-genkeypair', '-noprompt', '-storetype', 'PKCS12', '-keystore', store, '-alias', 'supergpt-release', '-keyalg', 'RSA', '-keysize', '4096', '-sigalg', 'SHA256withRSA', '-validity', '10000', '-dname', 'CN=SuperGPT Release,O=SuperGPT', '-storepass:env', 'SUPERGPT_KEYSTORE_PASSWORD', '-keypass:env', 'SUPERGPT_KEYSTORE_PASSWORD'], { env: { ...process.env, SUPERGPT_KEYSTORE_PASSWORD: password }, stdio: 'pipe', windowsHide: true });
    writeFileSync(properties, `# Private credentials. Never commit or publish this file.\nstoreFile=${store.replaceAll('\\', '/')}\nstorePassword=${password}\nkeyAlias=supergpt-release\nkeyPassword=${password}\n`, { flag: 'wx', mode: 0o600 });
    if (process.platform !== 'win32') chmodSync(store, 0o600);
  }
  const values = readSigningProperties(properties);
  const der = execFileSync(keytool, ['-exportcert', '-keystore', values.storeFile, '-alias', values.keyAlias, '-storepass:env', 'SUPERGPT_KEYSTORE_PASSWORD'], { env: { ...process.env, SUPERGPT_KEYSTORE_PASSWORD: values.storePassword }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const cert = new X509Certificate(der), sha256 = cert.fingerprint256.replaceAll(':', '').toLowerCase();
  if (cert.subject.includes('Android Debug')) throw Error('A debug certificate cannot be used as the permanent release identity.');
  if (existsSync(pinFile)) { if (readSigningIdentity(root).sha256 !== sha256) throw Error('The keystore differs from the pinned release certificate. Restore the correct key.'); }
  else { mkdirSync(dirname(pinFile), { recursive: true }); writeFileSync(pinFile, JSON.stringify({ packageId: 'id.sakelar.client', alias: values.keyAlias, sha256, subject: cert.subject, validTo: cert.validTo }, null, 2) + '\n', { flag: 'wx' }); }
  const backup = join(homedir(), 'Documents', 'SuperGPT-Signing-Backup'); privateDirectory(backup);
  for (const [source, name] of [[values.storeFile, 'supergpt-release.p12'], [properties, 'release.properties']]) {
    const target = join(backup, name);
    if (existsSync(target)) { const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex'); if (digest(source) !== digest(target)) throw Error('Existing signing backup differs. It was not overwritten.'); }
    else { copyFileSync(source, target, constants.COPYFILE_EXCL); if (process.platform !== 'win32') chmodSync(target, 0o600); }
  }
  console.log(`Permanent release signing configured.\nKeystore: ${values.storeFile}\nLocal recovery copy: ${backup}\nPublic certificate SHA-256: ${sha256}\nPrivate credentials were not printed. Keep an additional secure offline backup.`);
}
try { main(); } catch (error) { console.error('Signing setup failed; existing keys were not replaced. ' + (error instanceof Error ? error.message.slice(0, 1800) : 'Check JAVA_HOME and filesystem permissions.')); process.exitCode = 1; }
