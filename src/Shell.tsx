import { useEffect, useState } from 'react';
import App from './App';
import { Desktop } from './desktop/Desktop';
import { Personal } from './personal/Personal';

export function Shell(){
 const[view,setView]=useState<'personal'|'workspace'>(()=>new URLSearchParams(location.search).get('view')==='workspace'?'workspace':'personal');
 useEffect(()=>{document.title=view==='personal'?'Chat — Personal':'Chat — Workspace'},[view]);
 const mobileLegacy=new URLSearchParams(location.search).get('mobile')==='1';
 if(mobileLegacy)return <App/>;
 return view==='personal'?<Personal onWorkspace={()=>setView('workspace')}/>:<Desktop onPersonal={()=>setView('personal')}/>;
}
