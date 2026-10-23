import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { createMobileTextPresenter } from './streamingText';
import { createStreamHaptics, streamHaptic } from './streamHaptics';
import { loadSettings } from '../lib/clientSettings';

export function MobileStreamingReply({ text, streaming, completionId, children }: { text: string; streaming: boolean; completionId?: string; children?: ReactNode }) {
  const [painted, setPainted] = useState(() => streaming ? '' : text);
  const wasLive = useRef(streaming), presenter = useRef<ReturnType<typeof createMobileTextPresenter> | null>(null);
  const haptics = useRef<ReturnType<typeof createStreamHaptics> | null>(null);
  if (!haptics.current) haptics.current = createStreamHaptics(streamHaptic);
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
  useEffect(() => {
    const enabled = loadSettings().streamHaptics;
    if (streaming) haptics.current?.progress(painted, enabled);
    else if (completionId && painted === text) haptics.current?.complete(enabled);
  }, [painted, streaming, completionId, text]);
  return <>{painted ? <RichText text={painted} streaming={streaming || painted !== text}/> : streaming && <div className="m-waiting" role="status" aria-label="Menunggu jawaban"><span/></div>}{!streaming && painted === text && children}</>;
}
