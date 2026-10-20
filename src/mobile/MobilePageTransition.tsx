import { useEffect, useRef, useState, type ReactNode } from 'react';

type Page = { identity: string; children: ReactNode; active: boolean };
export function settingsDirection(from: string, to: string) {
  const depth = (id: string) => id === 'settings/root' ? 0 : id.startsWith('settings/') ? 1 : 2;
  return depth(to) <= depth(from) ? 'back' : 'forward';
}

export function MobilePageTransition({ identity, active, children, directionHint }: { identity: string; active: boolean; children: ReactNode; directionHint?: 'forward' | 'back' }) {
  const last = useRef<Page>({ identity, children, active });
  const [leaving, setLeaving] = useState<Page | null>(null);
  const [direction, setDirection] = useState('forward');
  const current = useRef<HTMLDivElement>(null);
  if (last.current.identity !== identity) {
    // Adjust before commit so the old keyed layer keeps its component instance,
    // scroll offset and prepared data while fading out. Never remount a snapshot.
    const reduced = document.documentElement.dataset.reduceMotion === 'true' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setLeaving(active && last.current.active && !reduced ? last.current : null);
    setDirection(directionHint || settingsDirection(last.current.identity, identity));
  }
  last.current = { identity, children, active };
  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(null), 220);
    return () => window.clearTimeout(timer);
  }, [identity]);
  useEffect(() => { if (active) current.current?.querySelector<HTMLButtonElement>('header button')?.focus({ preventScroll: true }); }, [identity, active]);
  if (!active) return children;
  const pages = leaving && leaving.identity !== identity ? [leaving, last.current] : [last.current];
  return <div className={`m-page-transition m-nav-${direction}${leaving ? ' m-page-moving' : ''}`}>
    {pages.map(page => { const departing = page.identity !== identity; return <div key={page.identity} ref={departing ? undefined : current} className={`m-page-layer${departing ? ' m-page-departing' : ' m-page-current'}`} inert={departing} aria-hidden={departing || undefined}>{page.children}</div>; })}
  </div>;
}
