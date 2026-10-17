import { useEffect } from 'react';
import { MobileApp } from './mobile/MobileApp';
import { isNativeMobile } from './lib/nativeDesktop';
import { Desktop } from './desktop/Desktop';
import { MiniChat } from './desktop/MiniChat';

export function Shell(){
 useEffect(()=>{document.title='SuperGPT'},[]);
 if(new URLSearchParams(location.search).get('mini')==='1')return <MiniChat/>;
 if(isNativeMobile() || import.meta.env.MODE==='mobile' || new URLSearchParams(location.search).get('mobile')==='1')return <MobileApp/>;
 return <Desktop/>;
}
