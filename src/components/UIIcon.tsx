import type { CSSProperties, ReactNode } from 'react';

// Smooth vector geometry for the reference UI. No pixel-grid traces or font glyphs.
// Original reference-based drawings, not an official OpenAI icon distribution.
const icons: Record<string, ReactNode> = {
  home: <path fillRule="evenodd" d="M3.7 10.1 10.8 4a1.85 1.85 0 0 1 2.4 0l7.1 6.1c.45.38.7.94.7 1.53v7.62A1.75 1.75 0 0 1 19.25 21H15v-6.1a1.15 1.15 0 0 0-1.15-1.15h-3.7A1.15 1.15 0 0 0 9 14.9V21H4.75A1.75 1.75 0 0 1 3 19.25v-7.62c0-.59.25-1.15.7-1.53Z"/>,
  spaces: <><path d="m10.2 3.3 8.6 1.5a2 2 0 0 1 1.6 2.3l-2.1 11.4a2 2 0 0 1-2.3 1.6"/><rect x="3.5" y="6.5" width="13" height="15" rx="2.3" transform="rotate(-7 10 14)"/><path d="M9.4 5.3 9.7 4a1 1 0 0 1 .5-.7"/></>,
  image: <><rect x="3" y="3.5" width="18" height="17" rx="3"/><circle cx="15.8" cy="8.7" r="1.7"/><path d="m3.5 16 4.3-4.6a1.5 1.5 0 0 1 2.2 0l6 6.1M14.2 16.2l1.5-1.5a1.4 1.4 0 0 1 2 0l2.8 2.8"/></>,
  clock: <><circle cx="12" cy="12" r="9.3"/><path d="M12 6.3v6l-3.2 2.4"/></>,
  // Preserve the previously approved Plugins asset and its original 27px canvas.
  plugin: <use href="/plugins-symbol.svg#plugins"/>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/></>,
  dots: <g fill="currentColor" stroke="none"><circle cx="4" cy="12" r="1.55"/><circle cx="12" cy="12" r="1.55"/><circle cx="20" cy="12" r="1.55"/></g>,
  search: <><circle cx="10.6" cy="10.6" r="7.1"/><path d="m16 16 4.6 4.6"/></>,
  bell: <><path d="M6.9 9a5.1 5.1 0 0 1 10.2 0c0 4.1.65 5.25 1.55 6.8.35.6-.05 1.2-.75 1.2H6.1c-.7 0-1.1-.6-.75-1.2C6.25 14.25 6.9 13.1 6.9 9Z"/><path d="M9.8 20a2.5 2.5 0 0 0 4.4 0"/></>,
  edit: <><path d="M11.2 4H7.1A3.1 3.1 0 0 0 4 7.1v9.8A3.1 3.1 0 0 0 7.1 20h9.8a3.1 3.1 0 0 0 3.1-3.1v-4.1"/><path d="m10 14 .8-3.7 7.2-7.2a2.1 2.1 0 0 1 3 3l-7.3 7.1L10 14Z"/></>,
  plus: <path d="M12 3.8v16.4M3.8 12h16.4"/>,
  down: <path d="m7 9.5 4.3 4.3a1 1 0 0 0 1.4 0L17 9.5"/>,
  arrow: <path d="M12 20V4m-6.2 6.2 5.5-5.5a1 1 0 0 1 1.4 0l5.5 5.5"/>,
  mic: <><rect x="8.5" y="2.5" width="7" height="12.5" rx="3.5"/><path d="M5.5 10.5v1a6.5 6.5 0 0 0 13 0v-1M12 18v3.5"/></>,
  wave: <path d="M4 9.2v5.6M8 5v14M12 3.5v17M16 7v10M20 10v4"/>,
  shield: <><path d="M10.9 2.8a2.3 2.3 0 0 1 2.2 0L19 6a1.9 1.9 0 0 1 1 1.7v5.2c0 3.3-2.5 5.5-6.9 8a2.1 2.1 0 0 1-2.2 0C6.5 18.4 4 16.2 4 12.9V7.7A1.9 1.9 0 0 1 5 6l5.9-3.2Z"/><path d="m8.3 10 2.5 2-2.5 2M13.5 14h2.2"/></>,
  copy: <><path d="M7.5 8H5.2A2.2 2.2 0 0 0 3 10.2v8.6A2.2 2.2 0 0 0 5.2 21h8.6a2.2 2.2 0 0 0 2.2-2.2v-2.3"/><rect x="8" y="3" width="13" height="13" rx="2.3"/></>,
  sound: <><path d="M10.8 4.8 6.4 8.3H4a1 1 0 0 0-1 1v5.4a1 1 0 0 0 1 1h2.4l4.4 3.5c.55.44 1.2.1 1.2-.6V5.4c0-.7-.65-1.04-1.2-.6Z"/><path d="M16 8a5.5 5.5 0 0 1 0 8M19.4 5.3a9 9 0 0 1 0 13.4"/></>,
  expand: <><path d="M14.5 3.5h5a1 1 0 0 1 1 1v5M20 4l-6.5 6.5M3.5 14.5v5a1 1 0 0 0 1 1h5M4 20l6.5-6.5"/></>,
  list: <><circle cx="4.5" cy="5" r="1.7"/><circle cx="4.5" cy="12" r="1.7"/><circle cx="4.5" cy="19" r="1.7"/><path d="M10.5 5h10M10.5 12h10M10.5 19h10"/></>,
  panel: <><rect x="3" y="3.5" width="18" height="17" rx="2.8"/><path d="M8.5 3.5v17"/></>,
  'side-chat': <><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M12 8v8M8 12h8"/></>,
  panels: <><rect x="4" y="4" width="16" height="16" rx="2.4"/><path d="m10.5 9 2-1v8M10.5 16h4" strokeWidth="1.3"/></>,
  folder: <><path d="M3 8V6a2 2 0 0 1 2-2h4.1a2 2 0 0 1 1.4.6l1.5 1.5a2 2 0 0 0 1.4.6H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"/><path d="M3.5 9.5h17"/></>,
  map: <><circle cx="12" cy="5.8" r="2.8"/><path d="M12 8.6v10M7.2 13.2c-2.6.6-4.2 1.7-4.2 3.1C3 18.5 7 20.3 12 20.3s9-1.8 9-4c0-1.4-1.6-2.5-4.2-3.1"/></>,
  cube: <><path d="m10.8 2.8-7 4A2 2 0 0 0 3 8.5v7a2 2 0 0 0 .8 1.7l7 4a2.4 2.4 0 0 0 2.4 0l7-4a2 2 0 0 0 .8-1.7v-7a2 2 0 0 0-.8-1.7l-7-4a2.4 2.4 0 0 0-2.4 0Z"/><path d="m3.8 7.3 8.2 4.8 8.2-4.8M12 12.1v9"/></>,
  branch: <><circle cx="6" cy="4.5" r="2.2"/><circle cx="18" cy="4.5" r="2.2"/><circle cx="6" cy="19.5" r="2.2"/><path d="M6 6.7v10.6M18 6.7V9a4 4 0 0 1-4 4h-4a4 4 0 0 0-4 4"/></>,
  download: <><path d="M12 3v12m-5-5 4.3 4.3a1 1 0 0 0 1.4 0L17 10M3.5 15.5v3a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-3"/></>,
  settings: <><path d="M10.7 2.7h2.6c.65 0 1.1.45 1.25 1.1l.3 1.3 1.35.8 1.3-.4c.63-.2 1.22 0 1.55.56l1.3 2.25c.33.57.2 1.2-.3 1.65l-1 .9v1.58l1 .9c.5.45.63 1.08.3 1.65l-1.3 2.25c-.33.56-.92.76-1.55.56l-1.3-.4-1.35.8-.3 1.3c-.15.65-.6 1.1-1.25 1.1h-2.6c-.65 0-1.1-.45-1.25-1.1l-.3-1.3-1.35-.8-1.3.4c-.63.2-1.22 0-1.55-.56l-1.3-2.25c-.33-.57-.2-1.2.3-1.65l1-.9v-1.58l-1-.9c-.5-.45-.63-1.08-.3-1.65l1.3-2.25c.33-.56.92-.76 1.55-.56l1.3.4 1.35-.8.3-1.3c.15-.65.6-1.1 1.25-1.1Z"/><circle cx="12" cy="11.65" r="3.1"/></>,
  logout: <><path d="M9.5 3.5h-4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h4M9 12h11M16 7l4.3 4.3a1 1 0 0 1 0 1.4L16 17"/></>,
  refresh: <><path d="M4.5 8A8.4 8.4 0 1 1 4 15M4.5 3v5h5"/></>,
  check: <path d="m5 12.2 4.4 4.4a.8.8 0 0 0 1.2-.05L19 6.5"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  page: <><path d="M14.5 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5a2 2 0 0 0-.6-1.4l-3.5-3.5a2 2 0 0 0-1.4-.6Z"/><path d="M14 3.5V7a2 2 0 0 0 2 2h3.5M8 13h8M8 17h5"/></>,
  filter: <path d="M3.5 5.5h17M7 11.5h10M10 17.5h4"/>,
  hand: <path d="M8 12V6.2a1.7 1.7 0 0 1 3.4 0v4.3-7.3a1.7 1.7 0 0 1 3.4 0v7.3-5.7a1.7 1.7 0 0 1 3.4 0v6-3.5a1.6 1.6 0 0 1 3.2 0v7.2c0 4.1-2.8 7-6.5 7h-2.5c-2.5 0-4-1.5-5.4-3.5l-3.1-4.5a1.8 1.8 0 0 1 2.9-2.1L8 13"/>,
  pin: <path d="m14.2 3.3 6.5 6.5a1.2 1.2 0 0 1-.8 2l-3.6.2-3.5 4.1a1.1 1.1 0 0 1-1.6 0L7.9 13a1.1 1.1 0 0 1 0-1.6L12 7.9l.2-3.6a1.2 1.2 0 0 1 2-.8ZM9.5 14.5 3.2 20.8"/>,
  archive: <><rect x="3" y="3.5" width="18" height="4.5" rx="1.5"/><path d="M4.5 8v10.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8M9.5 12h5"/></>,
  bubble: <><path d="M20.5 10.5a8.5 8.5 0 0 1-11.6 7.9l-4.5 1.4 1.4-4.5a8.5 8.5 0 1 1 14.7-4.8Z"/><path d="M12 6.8v7.4M8.3 10.5h7.4"/></>,
  comment: <path d="M21 11.3a8.8 8.8 0 0 1-12.3 8.1L3 21l1.6-5.4A8.8 8.8 0 1 1 21 11.3Z"/>,
  upload: <><path d="M12 16V3m-5 5 4.3-4.3a1 1 0 0 1 1.4 0L17 8M4 14.5v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></>,
  share: <path d="m20.8 3.2-7.4 17c-.4.9-1.7.8-1.9-.2l-1.2-6.3L4 12.5c-1-.2-1.1-1.5-.2-1.9l17-7.4ZM10.3 13.7l6.1-6.1"/>,
  window: <><path d="M8 3.5H5.5a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2H7"/><rect x="8" y="8" width="13" height="13" rx="2.4"/><path d="M13 12h4v4M17 12l-4 4"/></>,
  globe: <><circle cx="12" cy="12" r="9.3"/><ellipse cx="12" cy="12" rx="4.3" ry="9.3"/><path d="M3 12h18"/></>,
  terminal: <><rect x="3" y="3.5" width="18" height="17" rx="3"/><path d="m7.2 8.2 3.1 3.1a1 1 0 0 1 0 1.4l-3.1 3.1M13.5 15.5h3.3"/></>,
  bookmark: <path d="M7.5 3.5h9a2 2 0 0 1 2 2v14.8a.7.7 0 0 1-1.1.6L12 17.5l-5.4 3.4a.7.7 0 0 1-1.1-.6V5.5a2 2 0 0 1 2-2Z"/>,
  book: <><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v20H7.5A2.5 2.5 0 0 1 5 19.5v-15ZM5 18.5A2.5 2.5 0 0 1 7.5 16H19"/></>,
  library: <><rect x="3" y="3.5" width="5" height="17" rx="1.4"/><rect x="8" y="3.5" width="5" height="17" rx="1.4"/><rect x="14" y="3.3" width="5" height="17" rx="1.4" transform="rotate(-10 16.5 12)"/></>,
  computer: <><rect x="4" y="4" width="16" height="12" rx="1.7"/><path d="M2.5 16.5h19v2a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-2Z"/></>,
  paperclip: <path d="M7 10v7a5 5 0 0 0 10 0V6a3.5 3.5 0 0 0-7 0v10.5a1.5 1.5 0 0 0 3 0V7"/>,
  goal: <><path d="M20.8 12A8.8 8.8 0 1 1 12 3.2M16.5 3v4.5H21M16.5 7.5 12 12"/><path d="M16 12a4 4 0 1 1-4-4"/></>,
  bulb: <><path d="M8.5 15.5c0-2.3-3-3.8-3-7.3a6.5 6.5 0 0 1 13 0c0 3.5-3 5-3 7.3l-.1 1.5H8.6l-.1-1.5ZM9 20h6M10.4 22h3.2"/></>,
  sketch: <path d="M3 16.5C7 8.5 14.4 2 17 4.3c2.4 2.1-10.9 14.3-9 16.1 1.8 1.7 10.3-10.1 12.2-7.9 1.8 2.1-6.6 9.1-3.2 9.2 1.5 0 3.5-1.9 4.8-3.1"/>,
  feedback: <><g transform="translate(0 1) scale(.58)"><path d="M3 10h3v10H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM8 11l4-7.3c.6-1.1 2.3-.8 2.3.5V9h4.1a2 2 0 0 1 1.9 2.6l-2.1 6.9a2 2 0 0 1-1.9 1.5H8v-9Z"/></g><g transform="translate(24 23) rotate(180) scale(.58)"><path d="M3 10h3v10H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM8 11l4-7.3c.6-1.1 2.3-.8 2.3.5V9h4.1a2 2 0 0 1 1.9 2.6l-2.1 6.9a2 2 0 0 1-1.9 1.5H8v-9Z"/></g></>,
  'window-minimize': <path d="M5 12h14"/>,
  'window-maximize': <rect x="5" y="5" width="14" height="14" rx="1.5"/>,
  'window-restore': <><path d="M8 5V3.8A1.8 1.8 0 0 1 9.8 2h10.4A1.8 1.8 0 0 1 22 3.8v10.4a1.8 1.8 0 0 1-1.8 1.8H19"/><rect x="3" y="7" width="14" height="14" rx="1.7"/></>,
  cloud: <path d="M7 19h11a4 4 0 0 0 1-7.9 6 6 0 0 0-11.7-2A5 5 0 0 0 7 19Z"/>,
};

const aliases: Record<string, string> = { chat: 'comment', chevron: 'down', file: 'page', thumb: 'feedback', menu: 'list' };
const fallback = <><circle cx="12" cy="12" r="9"/><path d="M9.2 8.8a2.8 2.8 0 1 1 4 2.5c-1 .5-1.2 1-1.2 2.2M12 17h.01"/></>;

export const uiIconNames = [...Object.keys(icons), 'chrome', 'remotion', 'github', 'document', 'pdf', 'gmail', 'drive', 'brave'];

export function UIIcon({ name, size }: { name: string; size?: number }) {
  const resolved = aliases[name] || name;
  let drawing = icons[resolved];
  if (resolved === 'chrome') drawing = <g stroke="none"><path fill="#e64b3c" d="M12 1a11 11 0 0 1 9.5 5.5H12a5.5 5.5 0 0 0-4.8 8.2L2.5 6.5A11 11 0 0 1 12 1Z"/><path fill="#f4ce45" d="M21.5 6.5A11 11 0 0 1 12 23l4.8-8.3A5.5 5.5 0 0 0 12 6.5Z"/><path fill="#55a65b" d="M12 23A11 11 0 0 1 2.5 6.5l4.7 8.2a5.5 5.5 0 0 0 9.6 0Z"/><circle cx="12" cy="12" r="4.5" fill="#56a5e8" stroke="#eee" strokeWidth="1"/></g>;
  if (resolved === 'remotion') drawing = <path fill="currentColor" stroke="none" d="M6.7 4.7C9.1 2.2 20 8.7 20 12S9.1 21.8 6.7 19.3c-2.4-2.6-2.4-12 0-14.6Z"/>;
  if (resolved === 'github') drawing = <path fill="currentColor" stroke="none" d="M12 1.5a10.5 10.5 0 0 0-3.3 20.47c.52.1.72-.23.72-.5v-1.95c-2.92.63-3.54-1.24-3.54-1.24-.48-1.22-1.16-1.54-1.16-1.54-.95-.65.07-.63.07-.63 1.05.07 1.6 1.08 1.6 1.08.93 1.6 2.45 1.13 3.05.87.09-.68.37-1.14.66-1.4-2.33-.26-4.78-1.16-4.78-5.19 0-1.14.41-2.08 1.08-2.81-.11-.26-.46-1.33.1-2.77 0 0 .88-.28 2.87 1.07a10 10 0 0 1 5.22 0c1.99-1.35 2.87-1.07 2.87-1.07.56 1.44.21 2.51.1 2.77.67.73 1.08 1.67 1.08 2.81 0 4.04-2.46 4.92-4.8 5.18.37.33.71.96.71 1.94v2.87c0 .28.19.61.72.5A10.5 10.5 0 0 0 12 1.5Z"/>;
  if (resolved === 'document' || resolved === 'pdf') drawing = <><path fill={resolved === 'pdf' ? '#ac4053' : '#4684cf'} stroke="none" d="M7 2.5h6.2a2 2 0 0 1 1.4.6l4.3 4.3a2 2 0 0 1 .6 1.4V20a1.5 1.5 0 0 1-1.5 1.5H7A2.5 2.5 0 0 1 4.5 19V5A2.5 2.5 0 0 1 7 2.5Z"/><path d="M13.5 3v4.2a1.3 1.3 0 0 0 1.3 1.3H19M8 13h8M8 17h6" stroke="#d3e5ff" strokeWidth="1.1"/></>;
  if (resolved === 'gmail') drawing = <g fill="none" strokeWidth="3.4" strokeLinejoin="round"><path stroke="#4285f4" d="M3 20V6.8"/><path stroke="#34a853" d="M21 20V6.8"/><path stroke="#fbbc04" d="m21 6.8-4.5 3.7"/><path stroke="#ea4335" d="m3 6.8 9 7.2 9-7.2"/></g>;
  if (resolved === 'drive') drawing = <g stroke="none"><path fill="#2684fc" d="M2 16.5h20l-3 5H5Z"/><path fill="#00ac47" d="m8.5 2.5 6 1L6 18H1.2Z"/><path fill="#ffba00" d="m8.5 2.5 6 0 9 15.5H17Z"/></g>;
  if (resolved === 'brave') drawing = <><path fill="#fa5a19" stroke="none" d="m6 3 2-1h8l2 1 3 1-1 4v7c0 3-4 5.8-8 8-4-2.2-8-5-8-8V8L3 4l3-1Z"/><path d="m8 7 2-1 2 1 2-1 2 1 1 3-2 2 1 3-4 4-4-4 1-3-2-2 1-3ZM9 9l1.5 1M15 9l-1.5 1M10 14l2 1 2-1M12 12v3" stroke="#fff" strokeWidth="1.3"/></>;
  const style: CSSProperties | undefined = resolved === 'plugin' ? { ...(size === undefined ? {} : { width: size, height: size }), fill: 'currentColor', stroke: 'none' } : size === undefined ? undefined : { width: size, height: size };
  return <svg data-icon={resolved} data-icon-missing={drawing ? undefined : name} width={size || 24} height={size || 24} style={style}
    viewBox={resolved === 'plugin' ? '0 0 27 27' : '0 0 24 24'} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{drawing || fallback}</svg>;
}
