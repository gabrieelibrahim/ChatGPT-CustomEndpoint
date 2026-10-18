import { useLayoutEffect, type RefObject } from 'react';
import { UIIcon as Icon } from '../components/UIIcon';
import { MobileControlIcon } from './MobileControlIcon';

type Props = {
  input: RefObject<HTMLTextAreaElement | null>; value: string;
  expanded: boolean; engaged: boolean; uploading: boolean; busy: boolean; hasFiles: boolean; idleSend: boolean;
  onChange: (value: string) => void; onFocus: () => void; onBlur: () => void;
  onAttach: () => void; onDictate: () => void; onSend: () => void; onStop: () => void; onVoice: () => void;
};

export function MobileComposer(props: Props) {
  const { input, value, expanded, engaged, uploading, busy, hasFiles } = props;
  // Reset before measuring: the expanded first-focus input must shrink again on
  // reopening, after send/clear, and when dictation inserts text without typing.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    const resize = () => { el.style.height = '0px'; el.style.height = Math.min(136, Math.max(expanded ? 36 : 34, el.scrollHeight)) + 'px'; };
    resize();
    window.addEventListener('resize', resize);
    document.fonts?.addEventListener('loadingdone', resize);
    return () => { window.removeEventListener('resize', resize); document.fonts?.removeEventListener('loadingdone', resize); };
  }, [input, value, expanded, engaged]);
  const canSend = !!value.trim() || hasFiles;
  return <div className="m-composer">
    <button type="button" aria-label="Attach files" disabled={uploading || busy} onClick={props.onAttach}><Icon name="plus"/></button>
    <textarea ref={input} aria-label="Message" placeholder="Ask SuperGPT" rows={1} value={value} onFocus={props.onFocus} onBlur={props.onBlur} onChange={event => props.onChange(event.target.value)}/>
    <button type="button" aria-label="Dictate" onClick={props.onDictate}><MobileControlIcon name="mic"/></button>
    <button type="button" className={`m-send${props.idleSend && !canSend && !busy ? ' m-send-empty' : ''}`} aria-label={busy ? 'Stop generation' : canSend || props.idleSend ? 'Send message' : 'Voice mode'} disabled={uploading || (props.idleSend && !canSend && !busy)}
      // Keep the input focused until click: first-focus collapse otherwise
      // moves this button between pointerdown and pointerup and loses the tap.
      onPointerDown={event => event.preventDefault()}
      onClick={busy ? props.onStop : canSend ? props.onSend : props.onVoice}><Icon name={busy ? 'stop' : canSend || props.idleSend ? 'arrow' : 'wave'}/></button>
  </div>;
}
