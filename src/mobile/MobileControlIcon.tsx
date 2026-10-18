import { UIIcon } from '../components/UIIcon';

// Mobile reference silhouettes differ from the web SDK's dashed-chat and
// microphone-with-base glyphs. Keep these local to the mobile controls.
export function MobileControlIcon({ name }: { name: string }) {
  if (name === 'share-android') return <svg data-icon="share-android" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="5" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.3 10.7 7.4-4.4m-7.4 7 7.4 4.4"/>
  </svg>;
  if (name === 'mic') return <svg data-icon="mic" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="8.5" y="2" width="7" height="12" rx="3.5"/><path d="M5 10.5v1a7 7 0 0 0 14 0v-1M12 18.5V22"/>
  </svg>;
  if (name === 'temporary' || name === 'temporary-checked') return <svg data-icon={name} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5.1 5.2A9.5 9.5 0 0 1 19 5.7M21.2 9.5a9.5 9.5 0 0 1-11.4 11.7M6.6 19.9 2.8 21l1.1-3.9a9.5 9.5 0 0 1-1-9.1"/>
    {name === 'temporary-checked' && <path d="m8 11.8 2.7 2.8 5.3-5.4"/>}
  </svg>;
  return <UIIcon name={name}/>;
}
