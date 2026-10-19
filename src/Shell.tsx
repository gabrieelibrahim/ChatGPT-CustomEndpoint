import { useEffect } from 'react';
import { MobileApp } from './mobile/MobileApp';
import { isNativeMobile } from './lib/nativeDesktop';
import { Desktop } from './desktop/Desktop';
import { MiniChat } from './desktop/MiniChat';
export function Shell() {
 useEffect(() => { document.title = 'SuperGPT'; }, []);
 const params = new URLSearchParams(location.search);
 if (params.get('mini') === '1') return <MiniChat/>;
 if (isNativeMobile() || import.meta.env.MODE === 'mobile' || params.get('mobile') === '1') return <MobileApp/>;
 return <Desktop/>;
}
