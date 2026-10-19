import { lazy, Suspense, useEffect, useState } from 'react';
import { MobileApp } from './mobile/MobileApp';
import { isNativeMobile } from './lib/nativeDesktop';
import { Desktop } from './desktop/Desktop';
import { MiniChat } from './desktop/MiniChat';
const ChatKitWorkspace = lazy(() => import('./chatkit/ChatKitWorkspace').then(module => ({ default: module.ChatKitWorkspace })));

export function Shell(){
 const [chatkit,setChatkit]=useState(()=>new URLSearchParams(location.search).get('chatkit')==='1');
 const [baseMounted,setBaseMounted]=useState(()=>new URLSearchParams(location.search).get('chatkit')!=='1');
 useEffect(()=>{const open=()=>setChatkit(true);window.addEventListener('supergpt-chatkit-open',open);return()=>window.removeEventListener('supergpt-chatkit-open',open)},[]);
 useEffect(()=>{document.title='SuperGPT'},[]);
 const sdk=chatkit?<Suspense fallback={<div role="status">Memuat SuperGPT…</div>}><ChatKitWorkspace onClose={()=>{setChatkit(false);setBaseMounted(true);const url=new URL(location.href);url.searchParams.delete('chatkit');history.replaceState(null,'',url)}}/></Suspense>:null;
 if(new URLSearchParams(location.search).get('mini')==='1')return <MiniChat/>;
 if(isNativeMobile() || import.meta.env.MODE==='mobile' || new URLSearchParams(location.search).get('mobile')==='1')return <>{baseMounted&&<div hidden={chatkit} inert={chatkit} style={{height:'100%'}}><MobileApp suspended={chatkit}/></div>}{sdk}</>;
 if(chatkit)return sdk;
 return <Desktop/>;
}
