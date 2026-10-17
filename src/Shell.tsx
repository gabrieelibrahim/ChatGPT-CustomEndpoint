import { useEffect } from 'react';
import App from './App';
import { Desktop } from './desktop/Desktop';
import { MiniChat } from './desktop/MiniChat';

export function Shell(){
 useEffect(()=>{document.title='SuperGPT'},[]);
 const mobileLegacy=new URLSearchParams(location.search).get('mobile')==='1';
 if(mobileLegacy)return <App/>;
 if(new URLSearchParams(location.search).get('mini')==='1')return <MiniChat/>;
 return <Desktop/>;
}
