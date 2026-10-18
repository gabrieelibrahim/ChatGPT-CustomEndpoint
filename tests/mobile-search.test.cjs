const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { buildSync } = require('esbuild');
const built = buildSync({ entryPoints: [path.join(__dirname, '../src/mobile/searchData.ts')], bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text;
const mod = new Module(__filename + '.fixture', module); mod.paths = module.paths; mod._compile(built, __filename);
const { fileCategory, fileSearchItems, filterSearchItems, chatSearchItems, loadMobileProjects } = mod.exports;

test('recent files retain their identity, MIME fallback, type labels and newest-first order', () => {
  const input = [{ id: 'web', name: 'REINA.HTML', type: '', added: 2 }, { id: 'film', name: 'opaque', type: 'video/mp4', added: 3 }, { id: 'doc', name: 'proposal.pdf', type: 'application/pdf', added: 1 }];
  const files = fileSearchItems(input);
  assert.deepEqual(files.map(file => [file.id, file.detail]), [['film', 'Video'], ['web', 'HTML'], ['doc', 'Dokumen']]);
  assert.equal(files[0].file, input[1]); assert.equal(input[0].id, 'web');
  assert.equal(fileCategory('PHOTO.PNG', '').kind, 'Images');
  assert.equal(fileCategory('voice', 'audio/ogg').detail, 'Audio');
  assert.equal(fileCategory('unknown', '').detail, 'Dokumen');
});

test('search matches normalized title/content within the selected category without conflating names', () => {
  const items = [
    { id: 'chat', title: 'Reina', text: 'Membuat halaman HTML', kind: 'Chats' },
    { id: 'web', title: 'reina.html', kind: 'Documents' },
    { id: 'image', title: 'Reina', kind: 'Images' },
    { id: 'project', title: 'Project', text: 'REINA', kind: 'Projects' },
  ];
  assert.equal(filterSearchItems(items, '  ＲＥＩＮＡ  ', 'Top').length, 4);
  assert.deepEqual(filterSearchItems(items, 'reina', 'Images').map(item => item.id), ['image']);
  assert.deepEqual(filterSearchItems(items, 'html', 'Chats').map(item => item.id), ['chat']);
  assert.deepEqual(filterSearchItems(items, 'absent', 'Top'), []);
});

test('local search excludes archived chats and tolerates malformed content/projects', () => {
  const previous = global.localStorage;
  const values = { 'desktop-chat-content': JSON.stringify({ Visible: [{ text: 'Needle', timestamp: 100 }], Archived: [{ text: 'private' }] }), 'client-mobile-projects-v1': JSON.stringify([{ id: 'p', name: 'Project', chats: ['Visible'] }, { id: 'bad', name: 8, chats: [] }]) };
  global.localStorage = { getItem(key) { return values[key] || null; } };
  try {
    assert.deepEqual(chatSearchItems(['Visible', 'Archived'], ['Archived']).map(item => item.id), ['Visible']);
    assert.equal(filterSearchItems(chatSearchItems(['Visible'], []), 'needle', 'Top').length, 1);
    assert.equal(loadMobileProjects().length, 1);
    values['desktop-chat-content'] = '{'; values['client-mobile-projects-v1'] = '{}';
    assert.equal(chatSearchItems(['Visible'], [])[0].title, 'Visible'); assert.deepEqual(loadMobileProjects(), []);
  } finally { if (previous === undefined) delete global.localStorage; else global.localStorage = previous; }
});
