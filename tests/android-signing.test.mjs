import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateApkMetadata, validateApkSignature } from '../scripts/publishAndroidRelease.mjs';
import { readSigningProperties } from '../scripts/androidSigning.mjs';

test('public APK policy rejects debug packages and debuggable production packages', () => {
  const release = "package: name='id.sakelar.client' versionName='1.2.0'\nnative-code: 'arm64-v8a'\n";
  validateApkMetadata('v1.2.0', release);
  assert.throws(() => validateApkMetadata('v1.2.0', release.replace('id.sakelar.client', 'id.sakelar.client.debug')));
  assert.throws(() => validateApkMetadata('v1.2.0', release + 'application-debuggable\n'));
});
test('public APK policy requires the pinned signer and rejects debug or additional signers', () => {
  const pin = 'ab'.repeat(32), report = `Signer #1 certificate DN: O=SuperGPT, CN=SuperGPT Release\nSigner #1 certificate SHA-256 digest: ${pin}\n`;
  validateApkSignature(report, pin);
  assert.throws(() => validateApkSignature(report, 'cd'.repeat(32)));
  assert.throws(() => validateApkSignature(report.replace('SuperGPT Release', 'Android Debug'), pin));
  assert.throws(() => validateApkSignature(report + `Signer #2 certificate SHA-256 digest: ${pin}\n`, pin));
  assert.throws(() => validateApkSignature('Unsigned APK', pin));
});
test('missing or partial signing credentials fail closed without generating a replacement', () => {
  const folder = mkdtempSync(join(tmpdir(), 'supergpt-signing-policy-'));
  try {
    const properties = join(folder, 'release.properties');
    assert.throws(() => readSigningProperties(properties));
    writeFileSync(properties, 'storeFile=missing\nstorePassword=fixture\nkeyAlias=release\n');
    assert.throws(() => readSigningProperties(properties));
    const store = join(folder, 'fixture.p12'); writeFileSync(store, 'Test placeholder; not a real private key.');
    writeFileSync(properties, `storeFile=${store.replaceAll('\\', '/')}\nstorePassword=fixture\nkeyAlias=release\nkeyPassword=fixture\n`);
    assert.equal(readSigningProperties(properties).keyAlias, 'release');
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
