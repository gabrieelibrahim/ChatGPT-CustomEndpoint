// The only things a rich block can do, each started by the user's tap: copy, share, save a file, or place text in
// the composer (the user still presses Send). No network calls, native bridges beyond these, or credentials.
import { exportDeviceFile } from '../mobile/deviceActions';
import { shareMobileResponse } from '../mobile/MobileResponseActions';

export async function richCopy(text: string) { await navigator.clipboard.writeText(text); }
export async function richShare(text: string) {
  let failure = '';
  await shareMobileResponse(text, message => { failure = message; });
  if (failure && !/disalin/i.test(failure)) throw Error(failure);
}
export function richDownload(name: string, content: string, mime: string) { return exportDeviceFile(name, content, mime); }
export const COMPOSE_EVENT = 'supergpt-compose';
export function richCompose(text: string) { window.dispatchEvent(new CustomEvent(COMPOSE_EVENT, { detail: text.slice(0, 20000) })); }
