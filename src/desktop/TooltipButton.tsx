import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function TooltipButton({ label, tooltip, shortcut, className, onClick, children, enabled = true, disabled, expanded, controls }: {
  label: string; tooltip: string; shortcut?: string; className: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void; children?: ReactNode; enabled?: boolean;
  disabled?: boolean; expanded?: boolean; controls?: string;
}) {
  const button = useRef<HTMLButtonElement>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tip, setTip] = useState<{ left: number; top: number; side: 'right' | 'top' | 'bottom' } | null>(null);
  function hide() { if (timer.current) clearTimeout(timer.current); timer.current = null; setTip(null); }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function show(delay: number) {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const root = document.querySelector<HTMLElement>('.d-root'), target = button.current;
      if (!root || !target) return;
      const bounds = root.getBoundingClientRect(), rect = target.getBoundingClientRect();
      const scale = bounds.width / root.offsetWidth;
      const side = target.closest('.d-rail') ? 'right' : target.closest('.d-titlebar') ? 'bottom' : 'top';
      setTip({
        side,
        left: side === 'right' ? (rect.right - bounds.left) / scale + 4 : Math.max(90, Math.min(root.offsetWidth - 90, (rect.left + rect.width / 2 - bounds.left) / scale)),
        top: side === 'right' ? (rect.top + rect.height / 2 - bounds.top) / scale : side === 'top' ? (rect.top - bounds.top) / scale - 8 : (rect.bottom - bounds.top) / scale + 8,
      });
    }, delay);
  }
  const root = typeof document === 'undefined' ? null : document.querySelector('.d-root');
  return <><button ref={button} className={className} aria-label={label} disabled={disabled} aria-expanded={expanded} aria-controls={controls} onMouseEnter={() => show(450)} onMouseLeave={hide}
    onFocus={event => { if (event.currentTarget.matches(':focus-visible')) show(0); }} onBlur={hide} onPointerDown={hide}
    onClick={event => { hide(); onClick?.(event); }}>{children}</button>
    {tip && root && createPortal(<div className={'d-tooltip d-tooltip-' + tip.side} role="tooltip" style={{ left: tip.left, top: tip.top }}><span>{tooltip}</span>{shortcut && <kbd>{shortcut}</kbd>}</div>, root)}
  </>;
}
