import { mkdtempSync, readFileSync, writeFileSync, cpSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Launcher icons require an opaque backing. The in-app logo stays transparent.
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'supergpt-android-icons-'));
try {
  const logo = readFileSync(join(root, 'public/supergpt-logo.png')).toString('base64');
  writeFileSync(join(scratch, 'launcher.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254"><rect width="1254" height="1254" fill="#fff"/><image x="125.4" y="125.4" width="1003.2" height="1003.2" href="data:image/png;base64,${logo}"/></svg>`);
  // Reference APK foreground ink spans x=32..76 in a 108dp viewport.
  // The custom logo ink occupies 76.2% of its source canvas: 57.7 * .762 = 44dp.
  writeFileSync(join(scratch, 'foreground.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108"><image x="25.15" y="25.15" width="57.7" height="57.7" href="data:image/png;base64,${logo}"/></svg>`);
  writeFileSync(join(scratch, 'background.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108"><rect width="108" height="108" fill="#fff"/></svg>');
  writeFileSync(join(scratch, 'icons.json'), JSON.stringify({ default: 'launcher.svg', android_bg: 'background.svg', android_fg: 'foreground.svg', android_fg_scale: 100, android_monochrome: 'foreground.svg', bg_color: '#FFFFFF' }));
  const result = spawnSync(process.execPath, [join(root, 'node_modules/@tauri-apps/cli/tauri.js'), 'icon', join(scratch, 'icons.json'), '--output', join(scratch, 'generated')], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw result.error || Error(result.stderr || result.stdout || 'Android icon generation failed.');
  const res = join(root, 'src-tauri/gen/android/app/src/main/res');
  cpSync(join(scratch, 'generated/android'), res, { recursive: true });
  // Tauri's legacy Android generator enlarges the adaptive foreground. Render
  // the opaque full canvas separately so old launchers keep the same padding.
  for (const [density, size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]) {
    const legacy = spawnSync(process.execPath, [join(root, 'node_modules/@tauri-apps/cli/tauri.js'), 'icon', join(scratch, 'launcher.svg'), '--png', String(size), '--output', join(scratch, 'legacy')], { cwd: root, encoding: 'utf8', windowsHide: true });
    if (legacy.error || legacy.status !== 0) throw legacy.error || Error(legacy.stderr || legacy.stdout);
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) cpSync(join(scratch, 'legacy', `${size}x${size}.png`), join(res, `mipmap-${density}`, name));
  }
  // Keep both color and drawable fallback resources opaque for every launcher.
  writeFileSync(join(res, 'values/ic_launcher_background.xml'), '<resources><color name="ic_launcher_background">#FFFFFF</color></resources>\n');
  writeFileSync(join(res, 'drawable/ic_launcher_background.xml'), '<shape xmlns:android="http://schemas.android.com/apk/res/android"><solid android:color="#FFFFFFFF"/></shape>\n');
  console.log('Android launcher resources generated: black SuperGPT logo on white.');
} finally {
  const resolved = realpathSync(scratch);
  if (dirname(resolved).toLowerCase() !== realpathSync(tmpdir()).toLowerCase() || !basename(resolved).startsWith('supergpt-android-icons-')) throw Error('Unexpected icon scratch directory.');
  rmSync(resolved, { recursive: true, force: true });
}
