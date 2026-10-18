const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
function load(entry) { const built = buildSync({ absWorkingDir: path.resolve(__dirname, '..'), entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text; const mod = new Module(__filename, module); mod.paths = module.paths; mod._compile(built, __filename); return mod.exports; }
const { createSessionPress } = load('src/mobile/sessionPress.ts');
const { changeConversationName } = load('src/lib/mobileConversationMetadata.ts');
function fixture() {
  const values = new Map(Object.entries({ 'desktop-titles': ['A', 'B'], 'desktop-chat-content': { A: [{ text: 'Keep body', attachments: [{ id: 'photo' }] }], B: [{ text: 'Other' }] }, 'desktop-pinned': ['A'], 'desktop-archived': ['B'], 'client-mobile-projects-v1': [{ id: 'p', name: 'Project', chats: ['A', 'B'], extra: 'preserved' }] }).map(([k,v]) => [k, JSON.stringify(v)]));
  return { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k), read: k => JSON.parse(values.get(k)) };
}
test('hold opens once at 450ms and consumes release click; moving and native cancel keep scrolling', () => {
  let scheduled, delay, canceled = 0; const opened = [];
  const press = createSessionPress((x,y) => opened.push([x,y]), (run,ms) => { scheduled = run; delay = ms; return 1; }, () => { canceled++; scheduled = undefined; });
  press.down(25,40); assert.equal(delay,450); scheduled(); press.cancel();
  assert.deepEqual(opened,[[25,40]]); assert.equal(press.consumeClick(),true); assert.equal(press.consumeClick(),false);
  press.down(10,10); press.move(10,19); assert.equal(scheduled,undefined); assert.equal(press.consumeClick(),false);
  press.down(10,10); press.cancel(); assert.equal(scheduled,undefined); assert.equal(canceled,2);
  press.down(10,10); press.move(12,12); assert.equal(typeof scheduled,'function'); press.cancel();
});
test('rename preserves messages and replaces pin/archive/project references without overwriting another chat', () => {
  const store = fixture(); changeConversationName(store,'A',' Renamed ');
  assert.deepEqual(store.read('desktop-titles'),['Renamed','B']);
  assert.equal(store.read('desktop-chat-content').Renamed[0].attachments[0].id,'photo');
  assert.equal(store.read('desktop-chat-content').B[0].text,'Other');
  assert.deepEqual(store.read('desktop-pinned'),['Renamed']);
  assert.deepEqual(store.read('client-mobile-projects-v1')[0],{ id:'p', name:'Project', chats:['Renamed','B'],extra:'preserved' });
  assert.throws(() => changeConversationName(store,'Renamed','B'),/sudah dipakai/);
  assert.throws(() => changeConversationName(store,'Renamed',' '),/1–120/);
  changeConversationName(store,'B',null);
  assert.deepEqual(store.read('desktop-archived'),[]);
  assert.deepEqual(store.read('client-mobile-projects-v1')[0].chats,['Renamed']);
});
test('storage failure rolls back all affected metadata', () => {
  const store = fixture(), old = Object.fromEntries(['desktop-titles','desktop-chat-content','desktop-pinned','desktop-archived','client-mobile-projects-v1'].map(k => [k,store.getItem(k)]));
  const set = store.setItem; let fail = true;
  store.setItem = (k,v) => { if (k === 'desktop-pinned' && fail) { fail = false; throw Error('quota'); } set(k,v); };
  assert.throws(() => changeConversationName(store,'A','New'),/quota/);
  for (const [k,v] of Object.entries(old)) assert.equal(store.getItem(k),v);
});
