import { useEffect, useRef, useState, type RefObject, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { UIIcon } from '../components/UIIcon';
import { createEndPull, type PullFrame } from './endPull';

// Consume only deliberate overdrag at the completed conversation's lower edge.
// The indicator is an overlay: revealing it must never change scrollHeight.
export function MobileEndPull({ scroll, enabled, conversation, onNew }: {
  scroll: RefObject<HTMLDivElement | null>; enabled: boolean; conversation: string; onNew(): void;
}) {
  const [frame, setFrame] = useState<PullFrame | null>(null), [host, setHost] = useState<HTMLElement | null>(null);
  const latestNew = useRef(onNew); latestNew.current = onNew;
  useEffect(() => {
    const element = scroll.current, stack = element?.querySelector<HTMLElement>('.m-message-stack');
    setFrame(null); setHost(element?.parentElement || null);
    if (!element || !stack || !enabled) return;
    const reduced = () => document.documentElement.dataset.reduceMotion === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pull = createEndPull(value => {
      stack.style.setProperty('--m-pull-offset', value.distance + 'px');
      element.dataset.endPull = value.phase;
      setFrame(value);
    }, () => latestNew.current(), () => element.clientHeight, {
      now: () => performance.now(), request: callback => requestAnimationFrame(callback), cancel: cancelAnimationFrame,
    }, reduced);
    let wheelActive = false, wheelAllowed = false;
    let startX = 0, startY = 0, lastY = 0, tracking = false, claimed = false, pointer: number | undefined, wheelTimer: ReturnType<typeof setTimeout> | undefined;
    const atEnd = () => element.scrollHeight - element.scrollTop - element.clientHeight <= 5;
    const interactive = (target: EventTarget | null) => target instanceof Element && !!target.closest('button,a,input,textarea,select,pre,[contenteditable=true]');
    const begin = (x: number, y: number, target: EventTarget | null) => {
      tracking = false; claimed = false;
      if (!atEnd() || interactive(target)) { pull.reset(); return; }
      if (wheelTimer) clearTimeout(wheelTimer); wheelActive = wheelAllowed = false;
      tracking = pull.begin(); startX = x; startY = lastY = y;
    };
    const move = (x: number, y: number, event: Event) => {
      if (!tracking) return;
      if (!claimed) {
        if (Math.abs(x - startX) > Math.abs(y - startY) && Math.abs(x - startX) > 5) { tracking = false; pull.release(true); return; }
        if (startY - y < 5) { if (y - startY > 5) { tracking = false; pull.release(true); } return; }
        if (!atEnd()) { tracking = false; pull.release(true); return; }
        claimed = true;
      }
      if (event.cancelable) event.preventDefault();
      pull.move(lastY - y); lastY = y;
    };
    const end = (cancelled = false) => { if (tracking) pull.release(cancelled); tracking = claimed = false; pointer = undefined; };
    const touchStart = (event: TouchEvent) => { if (event.touches.length !== 1) { end(true); return; } begin(event.touches[0].clientX, event.touches[0].clientY, event.target); };
    const touchMove = (event: TouchEvent) => { if (event.touches.length !== 1) { end(true); return; } move(event.touches[0].clientX, event.touches[0].clientY, event); };
    const touchEnd = () => end(); const cancel = () => { if (wheelTimer) clearTimeout(wheelTimer); wheelActive = wheelAllowed = false; end(true); pull.release(true); };
    // Pointer drag is also available for mouse/pen preview; touch uses the
    // non-passive touchmove path so native scrolling stays intact until claimed.
    const pointerDown = (event: PointerEvent) => { if (event.pointerType === 'touch' || event.button !== 0) return; begin(event.clientX, event.clientY, event.target); if (tracking) pointer = event.pointerId; };
    const pointerMove = (event: PointerEvent) => { if (event.pointerId !== pointer) return; move(event.clientX, event.clientY, event); if (claimed && !element.hasPointerCapture(event.pointerId)) element.setPointerCapture(event.pointerId); };
    const pointerEnd = (event: PointerEvent) => { if (event.pointerId === pointer) end(event.type !== 'pointerup'); };
    const wheel = (event: WheelEvent) => {
      if (interactive(event.target) || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      // A scroll burst that began above the edge stays ordinary scrolling,
      // including its inertial tail. Only a fresh gesture at the edge can pull.
      if (!wheelActive) { wheelActive = true; wheelAllowed = atEnd() && event.deltaY > 0 && pull.begin(); }
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { if (wheelAllowed) pull.release(); wheelActive = wheelAllowed = false; }, 140);
      if (!wheelAllowed) return;
      if (event.cancelable) event.preventDefault();
      pull.move(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1));
    };
    const onScroll = () => { if (!atEnd() && pull.phase === 'dragging') cancel(); };
    element.addEventListener('touchstart', touchStart, { passive: true }); element.addEventListener('touchmove', touchMove, { passive: false });
    element.addEventListener('touchend', touchEnd); element.addEventListener('touchcancel', cancel);
    element.addEventListener('pointerdown', pointerDown); element.addEventListener('pointermove', pointerMove); element.addEventListener('pointerup', pointerEnd); element.addEventListener('pointercancel', pointerEnd); element.addEventListener('lostpointercapture', pointerEnd);
    element.addEventListener('wheel', wheel, { passive: false }); element.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('blur', cancel);
    return () => {
      pull.dispose(); if (wheelTimer) clearTimeout(wheelTimer); stack.style.removeProperty('--m-pull-offset'); delete element.dataset.endPull;
      element.removeEventListener('touchstart', touchStart); element.removeEventListener('touchmove', touchMove); element.removeEventListener('touchend', touchEnd); element.removeEventListener('touchcancel', cancel);
      element.removeEventListener('pointerdown', pointerDown); element.removeEventListener('pointermove', pointerMove); element.removeEventListener('pointerup', pointerEnd); element.removeEventListener('pointercancel', pointerEnd); element.removeEventListener('lostpointercapture', pointerEnd);
      element.removeEventListener('wheel', wheel); element.removeEventListener('scroll', onScroll); window.removeEventListener('blur', cancel);
    };
  }, [scroll, enabled, conversation]);
  if (!enabled || !host || !frame || frame.phase === 'idle') return null;
  return createPortal(<div className="m-end-pull" data-phase={frame.phase} data-armed={frame.armed} style={{
    bottom: scroll.current?.style.getPropertyValue('--m-footer-height') || '80px', opacity: frame.opacity,
    '--m-pull-center': frame.center + 'px', '--m-pull-scale': frame.scale, '--m-pull-icon-scale': frame.iconScale,
  } as CSSProperties}>
    <div className="m-pull-mark" aria-hidden="true"><svg className="m-pull-ring" viewBox="0 0 36 36"><circle className="m-pull-track" cx="18" cy="18" r="16.5"/><circle className="m-pull-progress" cx="18" cy="18" r="16.5" pathLength="100" strokeDasharray={`${Math.max(.5, frame.progress * 100)} 100`}/></svg><span className="m-pull-edit"><UIIcon name="edit"/></span></div>
    <span>Obrolan baru</span><span className="m-pull-announcement" role="status">{frame.armed ? 'Lepas untuk membuka obrolan baru' : ''}</span>
  </div>, host);
}
