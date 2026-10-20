import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, isAbsolute } from 'node:path';

export function signingPropertiesPath(env = process.env) {
  return env.SUPERGPT_ANDROID_SIGNING_PROPERTIES || join(homedir(), '.supergpt', 'signing', 'release.properties');
}
export function readSigningProperties(path) {
  if (!existsSync(path)) throw Error('Release signing is not configured. Run npm run android:signing:init, or restore the existing signing backup.');
  const values = Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#')).map(line => {
    const at = line.indexOf('='); if (at < 1) throw Error('Invalid signing properties.'); return [line.slice(0, at).trim(), line.slice(at + 1)];
  }));
  for (const key of ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']) if (!values[key]) throw Error(`Missing signing field: ${key}.`);
  if (!isAbsolute(values.storeFile) || !existsSync(values.storeFile)) throw Error('The existing release keystore must be restored; do not generate a replacement.');
  return values;
}
export function readSigningIdentity(root) {
  const path = join(root, 'config', 'android-release-signing.json');
  if (!existsSync(path)) throw Error('Public release signing identity is missing. Configure signing first.');
  const value = JSON.parse(readFileSync(path, 'utf8'));
  if (value.packageId !== 'id.sakelar.client' || !/^[a-f0-9]{64}$/.test(value.sha256)) throw Error('Invalid public release signing identity.');
  return value;
}
