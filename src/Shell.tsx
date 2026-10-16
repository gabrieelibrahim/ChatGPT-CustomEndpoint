import { useEffect } from 'react';
import App from './App';
import { Desktop } from './desktop/Desktop';

export function Shell(){
 useEffect(()=>{document.title='ChatGPT — Custom Endpoint'},[]);
 const mobileLegacy=new URLSearchParams(location.search).get('mobile')==='1';
 if(mobileLegacy)return <App/>;
 return <Desktop/>;
}