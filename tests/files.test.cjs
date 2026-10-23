const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const Module = require('node:module');
const { buildSync } = require('esbuild');
// pdf.js and the browser media decoders stay out of the Node bundle.
const built = buildSync({ entryPoints: [path.join(__dirname, '../src/lib/fileLibrary.ts')], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['pdfjs-dist*'] });
const loaded = new Module(__filename + '.fixture', module); loaded._compile(built.outputFiles[0].text, __filename);
const { saveLibraryFile, libraryFiles, removeLibraryFile, resolveMessageFiles } = loaded.exports;

// Office files are ZIP archives; build real deflated ones so the reader is tested end to end.
function zip(files) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name), data = zlib.deflateRawSync(Buffer.from(text));
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(Buffer.byteLength(text), 22); local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(Buffer.byteLength(text), 24); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data); centrals.push(central, nameBytes); offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

// Minimal asynchronous IndexedDB API fixture. Tests the client lifecycle and
// request hydration, not a browser's native IndexedDB implementation.
const records = new Map(); let notifications = 0;
global.window = new EventTarget(); window.addEventListener('client-files-changed', () => notifications++);
global.indexedDB = { open() {
  const request = {};
  queueMicrotask(() => { request.result = { close() {}, transaction() {
    const transaction = { objectStore() {
      const result = value => { const response = { result: value }; queueMicrotask(() => transaction.oncomplete?.()); return response; };
      return { put(value) { records.set(value.id, value); return result(value.id); }, get(id) { return result(records.get(id)); }, getAll() { return result([...records.values()]); }, delete(id) { records.delete(id); return result(undefined); } };
    } }; return transaction;
  } }; request.onsuccess(); }); return request;
} };
global.FileReader = class { readAsDataURL(blob) { blob.arrayBuffer().then(buffer => { this.result = 'data:' + blob.type + ';base64,' + Buffer.from(buffer).toString('base64'); this.onload(); }, () => this.onerror()); } };
test.beforeEach(() => { records.clear(); notifications = 0; });

test('library keeps blobs outside conversation metadata and publishes storage changes', async () => {
  const reference = await saveLibraryFile(new File(['source'], 'readme.txt', { type: 'text/plain' }), 'source');
  assert.deepEqual(reference, { id: 'source', name: 'readme.txt', type: 'text/plain' });
  const files = await libraryFiles(); assert.equal(await files[0].blob.text(), 'source'); assert.equal(notifications, 1);
  await removeLibraryFile('source'); assert.equal((await libraryFiles()).length, 0); assert.equal(notifications, 2);
});

test('text hydration adds explicit file context without mutating saved messages', async () => {
  const ref = await saveLibraryFile(new File(['Hello 🌏'], 'hello.md', { type: 'text/markdown' }));
  const messages = [{ role: 'user', text: 'Summarize', attachments: [ref] }];
  const resolved = await resolveMessageFiles(messages, new AbortController().signal);
  assert.equal(messages[0].text, 'Summarize'); assert.match(resolved[0].text, /Attached file: hello.md/); assert.match(resolved[0].text, /Hello 🌏/);
});

test('vision hydration generates image data only for supported image types', async () => {
  const ref = await saveLibraryFile(new File(['image-bytes'], 'image.png', { type: 'image/png' }));
  const resolved = await resolveMessageFiles([{ role: 'user', text: 'Describe', attachments: [ref] }], new AbortController().signal);
  assert.deepEqual(resolved[0].images, ['data:image/png;base64,' + Buffer.from('image-bytes').toString('base64')]); assert.equal(resolved[0].text, 'Describe');
});

test('missing and unsupported attachments still fail before sending', async () => {
  const signal = new AbortController().signal;
  await assert.rejects(resolveMessageFiles([{ role: 'user', text: '', attachments: [{ id: 'missing', name: 'missing.txt' }] }], signal), /tidak ditemukan/);
  const binary = await saveLibraryFile(new File([new Uint8Array([80, 75, 3, 4, 0, 0, 1])], 'archive.bin', { type: 'application/octet-stream' }));
  await assert.rejects(resolveMessageFiles([{ role: 'user', text: '', attachments: [binary] }], signal), /belum didukung/);
  const audio = await saveLibraryFile(new File(['id3'], 'voice.m4a', { type: 'audio/mp4' }));
  await assert.rejects(resolveMessageFiles([{ role: 'user', text: '', attachments: [audio] }], signal), /Audio voice.m4a belum didukung/);
});

test('attachment count and earlier turns are forwarded without truncation', async () => {
  const signal = new AbortController().signal;
  const image = await saveLibraryFile(new File(['tiny'], 'image.png', { type: 'image/png' }));
  assert.equal((await resolveMessageFiles([{ role: 'user', text: '', attachments: Array(8).fill(image) }], signal))[0].images.length, 8);
  const history = Array.from({ length: 7 }, () => ({ role: 'user', text: '', attachments: [image] }));
  assert.equal((await resolveMessageFiles(history, signal)).length, 7);
});

test('local library and hydration accept images beyond the former file and history byte limits', async () => {
  const bytes = new Uint8Array(22 * 1024 * 1024 + 1); bytes[bytes.length - 1] = 255;
  const ref = await saveLibraryFile(new File([bytes], 'large.png', { type: 'image/png' }));
  const resolved = await resolveMessageFiles([{ role: 'user', text: 'Describe', attachments: [ref] }], new AbortController().signal);
  const image = resolved[0].images[0].split(',')[1];
  assert.ok(image.length > 28 * 1024 * 1024);
  const decoded = Buffer.from(image, 'base64'); assert.equal(decoded.length, bytes.length); assert.equal(decoded.at(-1), 255);
});

test('large text is included in full and video files have no local storage size ceiling', async () => {
  const text = 'x'.repeat(512 * 1024 + 1) + 'end-marker';
  const ref = await saveLibraryFile(new File([text], 'large.txt', { type: 'text/plain' }));
  const [resolved] = await resolveMessageFiles([{ role: 'user', text: '', attachments: [ref] }], new AbortController().signal);
  assert.ok(resolved.text.includes(text));
  const video = await saveLibraryFile(new File([new Uint8Array(11 * 1024 * 1024)], 'large.mp4', { type: 'video/mp4' }));
  const stored = (await libraryFiles()).find(file => file.id === video.id);
  assert.equal(stored.size, 11 * 1024 * 1024); assert.equal(stored.blob.type, 'video/mp4');
});

test('aborted attachment resolution does not prepare provider context', async () => {
  const ref = await saveLibraryFile(new File(['secret source'], 'file.txt', { type: 'text/plain' }));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(resolveMessageFiles([{ role: 'user', text: '', attachments: [ref] }], controller.signal), error => error.name === 'AbortError');
});

test('Word, PowerPoint and Excel files are sent as their text', async () => {
  const signal = new AbortController().signal;
  const docx = await saveLibraryFile(new File([zip({ 'word/document.xml': '<w:document><w:body><w:p><w:r><w:t>Laporan</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve">Q3 &amp; Q4</w:t></w:r></w:p><w:p><w:r><w:t>Baris dua</w:t></w:r></w:p></w:body></w:document>' })], 'laporan.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  const pptx = await saveLibraryFile(new File([zip({ 'ppt/slides/slide10.xml': '<p:sld><a:p><a:r><a:t>Penutup</a:t></a:r></a:p></p:sld>', 'ppt/slides/slide2.xml': '<p:sld><a:p><a:r><a:t>Pembuka</a:t></a:r></a:p></p:sld>' })], 'deck.pptx', { type: '' }));
  const xlsx = await saveLibraryFile(new File([zip({ 'xl/workbook.xml': '<workbook><sheets><sheet name="Penjualan" sheetId="1"/></sheets></workbook>', 'xl/sharedStrings.xml': '<sst><si><t>Produk</t></si><si><r><t>Kop</t></r><r><t>i</t></r></si></sst>', 'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Harga</t></is></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>25000</v></c><c r="C2"/></row></sheetData></worksheet>' })], 'data.xlsx', { type: '' }));
  const [resolved] = await resolveMessageFiles([{ role: 'user', text: 'Ringkas', attachments: [docx, pptx, xlsx] }], signal);
  assert.match(resolved.text, /\[Attached file: laporan.docx\]\nLaporan\tQ3 & Q4\nBaris dua\n\[End attached file\]/);
  assert.match(resolved.text, /--- Slide 1 ---\nPembuka\n\n--- Slide 2 ---\nPenutup/);
  assert.match(resolved.text, /--- Sheet Penjualan ---\nProduk\tHarga\nKopi\t25000\t/);
  assert.equal(resolved.images, undefined);
});

test('files with unknown extensions are sent when they are readable text', async () => {
  const ref = await saveLibraryFile(new File(['FROM node:24\nRUN npm ci'], 'Dockerfile', { type: '' }));
  const [resolved] = await resolveMessageFiles([{ role: 'user', text: '', attachments: [ref] }], new AbortController().signal);
  assert.match(resolved.text, /Attached file: Dockerfile\]\nFROM node:24/);
});
