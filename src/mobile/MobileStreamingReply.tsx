import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { createMobileTextPresenter } from './streamingText';

export function MobileStreamingReply({ text, streaming, children }: { text: string; streaming: boolean; children?: ReactNode }) {
  const [painted, setPainted] = useState(() => streaming ? '' : text);
  const wasLive = useRef(streaming), presenter = useRef<ReturnType<typeof createMobileTextPresenter> | null>(null);
  useEffect(() => {
    presenter.current = createMobileTextPresenter(setPainted, {
      now: () => performance.now(), request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id),
    }, streaming ? '' : text);
    return () => { presenter.current?.dispose(); presenter.current = null; };
  }, []);
  useEffect(() => {
    const reduced = document.documentElement.dataset.reduceMotion === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    presenter.current?.update(text, !reduced && (streaming || wasLive.current));
    wasLive.current = streaming;
  }, [text, streaming]);
  return <>{painted ? <RichText text={painted}/> : streaming && <div className="m-waiting" role="status" aria-label="Menunggu jawaban"><span/></div>}{!streaming && painted === text && children}</>;
}
