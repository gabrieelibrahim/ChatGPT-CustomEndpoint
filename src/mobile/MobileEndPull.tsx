import { useEffect, useState, type RefObject } from 'react';
import { UIIcon } from '../components/UIIcon';

// At the end of a completed conversation the reference exposes a new-chat
// shortcut after an extra upward swipe. It never starts a chat by itself.
export function MobileEndPull({ scroll, enabled, conversation, onNew }: {
  scroll: RefObject<HTMLDivElement | null>; enabled: boolean; conversation: string; onNew(): void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(false); }, [conversation, enabled]);
  useEffect(() => {
    const element = scroll.current;
    if (!element || !enabled) return;
    let start: number | undefined;
    const atEnd = () => element.scrollHeight - element.scrollTop - element.clientHeight < 3;
    const begin = (event: TouchEvent) => { start = event.touches.length === 1 && atEnd() ? event.touches[0].clientY : undefined; };
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 1 || !atEnd()) { start = undefined; return; }
      const y = event.touches[0].clientY;
      if (start === undefined) start = y;
      if (start - y > 36) setVisible(true);
    };
    const end = () => { start = undefined; };
    const wheel = (event: WheelEvent) => { if (atEnd() && event.deltaY > 36) setVisible(true); };
    element.addEventListener('touchstart', begin, { passive: true });
    element.addEventListener('touchmove', move, { passive: true });
    element.addEventListener('touchend', end); element.addEventListener('touchcancel', end);
    element.addEventListener('wheel', wheel, { passive: true });
    return () => { element.removeEventListener('touchstart', begin); element.removeEventListener('touchmove', move); element.removeEventListener('touchend', end); element.removeEventListener('touchcancel', end); element.removeEventListener('wheel', wheel); };
  }, [scroll, enabled]);
  return enabled && visible ? <div className="m-end-pull"><button type="button" onClick={onNew}><span><UIIcon name="edit"/></span>Obrolan baru</button></div> : null;
}
