import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startupFailure } from '../scripts/androidStartupSmoke.mjs';
import { validateStartupReport } from '../scripts/publishAndroidRelease.mjs';

const ready = { pid: '1234', activity: 'mResumedActivity: id.sakelar.client/.MainActivity', ui: '<node class="android.webkit.WebView"><node text="Chat"/></node>', crash: '', packageName: 'id.sakelar.client' };
test('startup verification requires a surviving process and rendered WebView, not am start status ok', () => {
  assert.equal(startupFailure(ready), '');
  assert.match(startupFailure({ ...ready, pid: '' }), /process exited/);
  assert.match(startupFailure({ ...ready, ui: '' }), /did not render/);
  assert.match(startupFailure({ ...ready, activity: 'mResumedActivity: com.android.launcher/.Launcher' }), /not the resumed/);
});
test('startup verification rejects process-specific Java/native crashes and WebView failures', () => {
  assert.match(startupFailure({ ...ready, crash: 'Process: id.sakelar.client, PID: 1234\nNoSuchMethodException: enum.values' }), /crashed/);
  assert.match(startupFailure({ ...ready, crash: 'Cmdline: id.sakelar.client\nFatal signal 6' }), /crashed/);
  assert.equal(startupFailure({ ...ready, crash: 'Process: another.app, PID: 4321' }), '');
  assert.match(startupFailure({ ...ready, ui: ready.ui + 'ERR_CLEARTEXT_NOT_PERMITTED' }), /load error/);
});
test('release optimization keeps the Android platform runtime rules alongside project JNI rules', () => {
  const gradle = readFileSync(new URL('../src-tauri/gen/android/app/build.gradle.kts', import.meta.url), 'utf8');
  const release = gradle.slice(gradle.indexOf('getByName("release")'));
  assert.match(release, /isMinifyEnabled = true/);
  assert.match(release, /getDefaultProguardFile\("proguard-android-optimize\.txt"\)/);
  assert.match(release, /fileTree\("\."\)/);
});
test('publication requires a successful runtime check of the exact APK being uploaded', () => {
  const report = { packageName: 'id.sakelar.client', sha256: 'a'.repeat(64), passed: true, processAlive: true, uiRendered: true, failure: '' };
  assert.doesNotThrow(() => validateStartupReport(report, report.sha256));
  for (const override of [{ sha256: 'b'.repeat(64) }, { passed: false }, { processAlive: false }, { uiRendered: false }, { packageName: 'id.sakelar.client.debug' }, { failure: 'Startup crash' }]) {
    assert.throws(() => validateStartupReport({ ...report, ...override }, report.sha256), /startup report/);
  }
});
