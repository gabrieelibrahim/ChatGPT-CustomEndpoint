import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { B, I } from './Desktop';

export function HistoryList({titles,pinned,archived,active,onNew,onOpen,onPin,onArchive}:{titles:string[];pinned:string[];archived:string[];active:string;onNew:()=>void;onOpen:(t:string)=>void;onPin:(t:string)=>void;onArchive:(t:string)=>void}){
 const[hover,setHover]=useState<{title:string;top:number}|null>(null),[collapsed,setCollapsed]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 function cancel(){if(timer.current)clearTimeout(timer.current)}
 function leave(){cancel();timer.current=setTimeout(()=>setHover(null),120)}
 useEffect(()=>()=>cancel(),[]);
 function enter(t:string,el:HTMLElement){cancel();const root=document.querySelector('.d-root')!.getBoundingClientRect();const scale=root.width/(document.querySelector('.d-root') as HTMLElement).offsetWidth;const rect=el.getBoundingClientRect();timer.current=setTimeout(()=>setHover({title:t,top:Math.min((rect.top-root.top)/scale,root.height/scale-110)}),350)}
 function row(t:string){return <div key={t} className={'d-history-row '+(active===t?'d-selected':'')} onMouseEnter={e=>enter(t,e.currentTarget)} onMouseLeave={leave} onFocus={e=>enter(t,e.currentTarget)} onBlur={leave}><button className="d-history-open" onClick={()=>{setHover(null);onOpen(t)}}>{t}</button><div className="d-history-actions"><B icon="pin" label={pinned.includes(t)?'Unpin chat':'Pin chat'} onClick={()=>onPin(t)}/><B icon="archive" label="Archive chat" onClick={()=>{setHover(null);onArchive(t)}}/></div></div>}
 return <div className="d-history-list"><B icon="edit" label="New chat" className="d-navrow" onClick={onNew}>New chat</B>{pinned.some(t=>!archived.includes(t))&&<><h3>Pinned</h3>{pinned.filter(t=>!archived.includes(t)).map(row)}</>}<h3>Projects</h3><p className="d-empty">No projects</p><button className="d-recents-toggle" aria-expanded={!collapsed} onClick={()=>setCollapsed(!collapsed)}>Recents <span className={collapsed?'d-closed':''}><I name="down" size={15}/></span></button>{!collapsed&&titles.filter(t=>!pinned.includes(t)&&!archived.includes(t)).map(row)}{hover&&createPortal(<div className="d-history-preview" style={{top:hover.top}} onMouseEnter={cancel} onMouseLeave={leave}><div><b>{hover.title}</b><I name="panel" size={16}/><time>3h</time></div><p><I name="bubble" size={20}/> Chat</p></div>,document.querySelector('.d-root')!)} </div>
}

const groups=[[
 ['edit','Rename','Ctrl+Alt+R'],['pin','Pin','Ctrl+Alt+P']],
 [['bubble','New side chat','Ctrl+Alt+S'],['branch','Fork','›'],['clock','Add scheduled task...','']],
 [['upload','Share',''],['copy','Copy','›']],
 [['window','Open in new window','']],
 [['archive','Archive','Ctrl+Shift+A']]];
export function ConversationActions({pinned,onAction}:{pinned:boolean;onAction:(a:string)=>void}){
 const[sub,setSub]=useState('');
 return <div className="d-popover d-conversation-actions" role="menu" aria-label="Conversation options">{groups.map((group,i)=><div className="d-action-group" key={i}>{group.map(([icon,label,key])=><div className="d-action-wrapper" key={label} onMouseEnter={()=>setSub(label==='Copy'||label==='Fork'?label:'')}><button role="menuitem" onClick={()=>{if(label==='Copy'||label==='Fork'){setSub(sub===label?'':label);return}onAction(label)}}><I name={icon}/><span>{label==='Pin'&&pinned?'Unpin':label}</span><small>{key}</small></button>{sub===label&&<div className="d-action-submenu">{(label==='Copy'?['Copy conversation','Copy title']:['Fork chat']).map(a=><button key={a} onClick={()=>a==='Copy title'?(void navigator.clipboard.writeText(document.querySelector('.d-chat-header strong')?.textContent||'')):onAction(a)}>{a}</button>)}</div>}</div>)}</div>)}</div>
}

export function SummaryPanel({files,onOpen}:{files:{name:string;url:string}[];onOpen:(s:string)=>void}){return <div className="d-popover d-summary"><section><h3>Outputs <B icon="plus" label="Add output" onClick={()=>onOpen('Add output')}/></h3><a href="http://127.0.0.1:5173/" target="_blank" rel="noreferrer"><I name="globe"/>127.0.0.1:5173</a></section><section><h3>Background processes</h3><p className="d-summary-process"><I name="terminal"/><span>Local UI preview · 127.0.0.1:5173</span></p></section><section><h3>Sources <B icon="plus" label="Add source" onClick={()=>onOpen('Add source')}/></h3>{files.length?files.slice(0,3).map(f=><button className="d-summary-source" key={f.url} onClick={()=>onOpen(f.name)}><img src={f.url} alt=""/><span>{f.name}</span></button>):<p className="d-summary-empty">No files attached</p>}<button className="d-summary-all" onClick={()=>onOpen('Sources')}><I name="share"/> View all</button></section></div>}

export function ConversationRail({scrollRef,messages,title}:{scrollRef:RefObject<HTMLDivElement|null>;messages:{role:string;text:string}[];title:string}){
 const[hover,setHover]=useState<number|null>(null),[active,setActive]=useState(0);
 const count=messages.length+1;
 useEffect(()=>{const el=scrollRef.current;if(!el)return;const update=()=>{const total=el.scrollHeight-el.clientHeight;setActive(total>0?Math.round(el.scrollTop/total*(count-1)):0)};el.addEventListener('scroll',update);return()=>el.removeEventListener('scroll',update)},[count,scrollRef]);
 function jump(i:number){const el=scrollRef.current;if(!el)return;const target=i===0?el.querySelector('.d-reference'):el.querySelectorAll('.d-user-message,.d-assistant-message')[i-1];if(target)(target as HTMLElement).scrollIntoView({behavior:'smooth',block:'start'});setActive(i)}
 return <nav className="d-turn-rail" aria-label="Conversation positions" onMouseLeave={()=>setHover(null)}>{Array.from({length:count},(_,i)=><div className="d-turn-position" key={i}><button aria-label={'Jump to '+(i===0?'reference answer':'message '+i)} className={active===i?'d-current':''} onMouseEnter={()=>setHover(i)} onFocus={()=>setHover(i)} onBlur={()=>setHover(null)} onClick={()=>jump(i)}><span/></button>{hover===i&&<div className="d-turn-preview"><b>{i===0?title:messages[i-1]?.text}</b><I name="bookmark" size={20}/><p>{i===0?'Sidebar, percakapan, composer, dan menu desktop mengikuti referensi tampilan.':messages[i-1]?.text}</p></div>}</div>)}</nav>
}
