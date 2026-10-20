import { libraryFile, type FileRef } from '../lib/fileLibrary';
export async function shareNativeDiagnostic(text: string) {
  const bridge = (window as unknown as { SuperGPTFile?: { postMessage(value: string): void } }).SuperGPTFile;
  if (!bridge) return false;
  const bytes = new TextEncoder().encode(text); let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  bridge.postMessage(JSON.stringify({ op: 'share', name: 'SuperGPT-logs.json', type: 'application/json', data: btoa(binary) }));
  return true;
}
export async function openDocumentAttachment(file: FileRef, url: string) {
  const bridge = (window as unknown as { SuperGPTFile?: { postMessage(value: string): void } }).SuperGPTFile;
  if (bridge) {
    const stored = await libraryFile(file.id);
    if (!stored) throw Error('File tidak tersedia di perangkat.');
    const bytes = new Uint8Array(await stored.blob.arrayBuffer()); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    bridge.postMessage(JSON.stringify({ name: file.name, type: file.type, data: btoa(binary) }));
  } else { const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); }
}
