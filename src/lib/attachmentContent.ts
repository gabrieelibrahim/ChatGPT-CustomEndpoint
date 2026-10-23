// Turns a stored attachment into what every chat transport can carry: text and
// PNG/JPEG/WebP/GIF data URLs. Video becomes evenly spaced frames, PDF and Office
// files become their text, so any vision model can read them without file APIs.
export type AttachmentPart = { text: string; images: string[] };
type Stored = { name: string; type: string; blob: Blob };

const visionImage = /^image\/(png|jpeg|webp|gif)$/;
const imageName = /\.(png|jpe?g|webp|gif|heic|heif|avif|bmp)$/i;
const videoName = /\.(mp4|m4v|webm|mov|mkv|3gp)$/i;
const audioName = /\.(mp3|m4a|aac|wav|ogg|opus|flac|amr)$/i;
const textName = /\.(txt|md|json|csv|tsv|js|jsx|ts|tsx|css|html?|xml|py|log|ya?ml|sql|java|kt|swift|go|rs|c|h|cpp|rb|php|sh|ini|toml|env|srt|vtt)$/i;
export const VIDEO_FRAMES = 8;

function dataUrl(blob: Blob): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(Error('File tidak bisa dibaca.')); reader.readAsDataURL(blob); }); }
const seconds = (value: number) => String(Math.round(value * 10) / 10);
const wrap = (label: string, name: string, body: string) => `[Attached ${label}: ${name}]\n${body}\n[End attached ${label}]`;

export async function attachmentPart(file: Stored, signal: AbortSignal): Promise<AttachmentPart> {
  const { name, type, blob } = file;
  if (visionImage.test(type)) return { text: '', images: [await dataUrl(blob)] };
  if (type.startsWith('image/') || (!type && imageName.test(name))) {
    // HEIC/AVIF/BMP: the provider only accepts the four web formats, so re-encode.
    const image = await imageAsJpeg(blob).catch(() => { throw Error('Foto ' + name + ' tidak bisa dibaca perangkat ini. Kirim sebagai JPG atau PNG.'); });
    return { text: '', images: [image] };
  }
  if (type.startsWith('video/') || videoName.test(name)) {
    const video = await videoFrames(blob, VIDEO_FRAMES, 768, signal).catch(failure => { signal.throwIfAborted(); throw Error('Video ' + name + ' tidak bisa diputar perangkat ini' + (failure instanceof Error && failure.message ? ' (' + failure.message + ')' : '') + '.'); });
    const at = video.times.map(seconds).join(', ');
    return { text: wrap('video', name, `Video berdurasi ${seconds(video.duration)} detik. ${video.frames.length} frame diambil berurutan pada detik ${at} dan dilampirkan sebagai gambar. Audio tidak disertakan.`), images: video.frames };
  }
  if (type.startsWith('audio/') || audioName.test(name)) throw Error('Audio ' + name + ' belum didukung. Gunakan dikte untuk mengirim suara.');
  if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
    const pdf = await pdfContent(blob, signal);
    return { text: wrap('file', name, pdf.text || `PDF ${pdf.pages} halaman tanpa teks. Halaman dilampirkan sebagai gambar.`), images: pdf.images };
  }
  const office = name.match(/\.(docx|pptx|xlsx)$/i)?.[1].toLowerCase();
  if (office) {
    const text = await officeText(await blob.arrayBuffer(), office as 'docx' | 'pptx' | 'xlsx').catch(() => { throw Error('File ' + name + ' rusak atau terkunci kata sandi.'); });
    return { text: wrap('file', name, text), images: [] };
  }
  const text = type.startsWith('text/') || textName.test(name) ? await blob.text() : await sniffText(blob);
  if (text === null) throw Error('Format ' + name + ' belum didukung. Kirim foto, video, PDF, Word, Excel, PowerPoint, atau file teks.');
  return { text: wrap('file', name, text), images: [] };
}

// Binary files contain NUL bytes or invalid UTF-8; everything else is readable text
// even when the extension is unknown (source files, configs, exports).
export async function sniffText(blob: Blob): Promise<string | null> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.subarray(0, 65536).includes(0)) return null;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return null; }
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob), image = new Image();
  return new Promise<HTMLImageElement>((resolve, reject) => { image.onload = () => resolve(image); image.onerror = () => reject(Error('decode')); image.src = url; }).finally(() => URL.revokeObjectURL(url));
}
function canvasFor(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height, 1)), canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
  return canvas;
}
async function imageAsJpeg(blob: Blob, maxSide = 2048) {
  const image = await loadImage(blob), canvas = canvasFor(image.naturalWidth, image.naturalHeight, maxSide);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

function once(target: HTMLMediaElement, event: string, signal?: AbortSignal, ms = 20000) {
  return new Promise<void>((resolve, reject) => {
    const done = (failure?: Error) => { clearTimeout(timer); target.removeEventListener(event, ok); target.removeEventListener('error', bad); signal?.removeEventListener('abort', aborted); if (failure) reject(failure); else resolve(); };
    const ok = () => done(), bad = () => done(Error('format tidak didukung')), aborted = () => done(Error('dibatalkan'));
    const timer = setTimeout(() => done(Error('waktu habis')), ms);
    target.addEventListener(event, ok); target.addEventListener('error', bad); signal?.addEventListener('abort', aborted);
  });
}

// Seeks a detached <video> and draws each frame; the bytes never leave the device
// except as the JPEG frames sent with the message.
export async function videoFrames(blob: Blob, count: number, maxSide: number, signal?: AbortSignal) {
  const url = URL.createObjectURL(blob), video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  try {
    const loaded = once(video, 'loadeddata', signal); video.src = url; video.load(); await loaded;
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const total = duration ? Math.max(1, Math.min(count, Math.ceil(duration))) : 1;
    const times = duration ? Array.from({ length: total }, (_, index) => total === 1 ? Math.min(duration / 2, 1) : duration * (index + 0.5) / total) : [0];
    const canvas = canvasFor(video.videoWidth, video.videoHeight, maxSide), context = canvas.getContext('2d')!, frames: string[] = [];
    for (const time of times) {
      signal?.throwIfAborted();
      if (Math.abs(video.currentTime - time) > 0.01) { const seeked = once(video, 'seeked', signal); video.currentTime = time; await seeked; }
      context.drawImage(video, 0, 0, canvas.width, canvas.height); frames.push(canvas.toDataURL('image/jpeg', 0.8));
    }
    return { duration, times, frames };
  } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}

// Thumbnails for the composer and sent messages, computed once per file.
const posters = new Map<string, Promise<string>>();
export function videoPoster(id: string, blob: Blob) {
  let poster = posters.get(id);
  if (!poster) { poster = videoFrames(blob, 1, 480).then(result => result.frames[0]); poster.catch(() => posters.delete(id)); posters.set(id, poster); }
  return poster;
}

// Scanned PDFs have no text layer; their first pages are sent as images instead.
async function pdfContent(blob: Blob, signal: AbortSignal) {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  try {
    const document_ = await task.promise.catch(() => { throw Error('PDF rusak atau terkunci kata sandi.'); });
    const pages: string[] = [];
    for (let number = 1; number <= document_.numPages; number++) {
      signal.throwIfAborted();
      const content = await (await document_.getPage(number)).getTextContent();
      pages.push(content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : '') : '').join('').trim());
    }
    if (pages.join('').replace(/\s/g, '').length >= 20 * pages.length) return { pages: pages.length, text: pages.map((text, index) => `--- Halaman ${index + 1} ---\n${text}`).join('\n\n'), images: [] };
    const images: string[] = [];
    for (let number = 1; number <= Math.min(8, document_.numPages); number++) {
      signal.throwIfAborted();
      const page = await document_.getPage(number), base = page.getViewport({ scale: 1 }), viewport = page.getViewport({ scale: Math.min(2, 1600 / Math.max(base.width, base.height)) });
      const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise; images.push(canvas.toDataURL('image/jpeg', 0.85));
    }
    return { pages: pages.length, text: document_.numPages > 8 ? `PDF ${document_.numPages} halaman tanpa teks; 8 halaman pertama dilampirkan sebagai gambar.` : '', images };
  } finally { await task.destroy(); }
}

// Minimal ZIP reader for Office Open XML: central directory, then stored or
// deflated entries through the platform DecompressionStream.
async function unzip(buffer: ArrayBuffer) {
  const view = new DataView(buffer), bytes = new Uint8Array(buffer), entries = new Map<string, () => Promise<string>>();
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) if (view.getUint32(at, true) === 0x06054b50) { end = at; break; }
  if (end < 0) throw Error('zip');
  let at = view.getUint32(end + 16, true);
  for (let index = view.getUint16(end + 10, true); index > 0; index--) {
    if (view.getUint32(at, true) !== 0x02014b50) throw Error('zip');
    const method = view.getUint16(at + 10, true), size = view.getUint32(at + 20, true), nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true), name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    entries.set(name, async () => {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true), data = bytes.slice(start, start + size);
      if (method === 0) return new TextDecoder().decode(data);
      if (method !== 8) throw Error('zip');
      return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    });
  }
  return entries;
}
const entity = (text: string) => text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, code: string) => code[0] === '#' ? String.fromCodePoint(parseInt(code.slice(code[1] === 'x' || code[1] === 'X' ? 2 : 1), code[1] === 'x' || code[1] === 'X' ? 16 : 10)) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[code.toLowerCase()]);
const numbered = (entries: Map<string, unknown>, pattern: RegExp) => [...entries.keys()].filter(name => pattern.test(name)).sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
const tidy = (text: string) => text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export async function officeText(buffer: ArrayBuffer, kind: 'docx' | 'pptx' | 'xlsx') {
  const entries = await unzip(buffer);
  const read = (name: string) => entries.get(name)?.() ?? Promise.resolve('');
  if (kind === 'docx') {
    const xml = await read('word/document.xml');
    return tidy(entity(xml.replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<\/w:p>|<w:tab\/>|<w:br\/>|<[^>]+>/g, (tag, text?: string) => text !== undefined ? text : tag === '</w:p>' || tag === '<w:br/>' ? '\n' : tag === '<w:tab/>' ? '\t' : '')));
  }
  if (kind === 'pptx') {
    const slides = await Promise.all(numbered(entries, /^ppt\/slides\/slide\d+\.xml$/).map(read));
    return slides.map((xml, index) => `--- Slide ${index + 1} ---\n` + tidy(entity(xml.replace(/<a:t>([^<]*)<\/a:t>|<\/a:p>|<[^>]+>/g, (tag, text?: string) => text !== undefined ? text : tag === '</a:p>' ? '\n' : '')))).join('\n\n');
  }
  const shared = [...(await read('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(match => entity([...match[1].matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map(text => text[1]).join('')));
  const names = [...(await read('xl/workbook.xml')).matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map(match => entity(match[1]));
  const sheets = await Promise.all(numbered(entries, /^xl\/worksheets\/sheet\d+\.xml$/).map(read));
  return sheets.map((xml, index) => `--- Sheet ${names[index] || index + 1} ---\n` + [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(row => [...row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, attributes, body = '']) => {
    const value = body.match(/<v>([^<]*)<\/v>/)?.[1];
    if (/\bt="s"/.test(attributes)) return shared[Number(value)] ?? '';
    if (/\bt="inlineStr"/.test(attributes)) return entity([...body.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map(text => text[1]).join(''));
    return entity(value ?? '');
  }).join('\t')).join('\n')).join('\n\n');
}
