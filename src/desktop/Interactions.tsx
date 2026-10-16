import { useEffect, useRef, useState, type RefObject } from 'react';
import { B, I } from './Desktop';

export { HistoryList } from './HistoryList';

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

export function SummaryPanel({files,onOpen}:{files:{name:string;url:string}[];onOpen:(s:string)=>void}){return <div className="d-popover d-summary"><section><h3>Outputs <B icon="plus" label="Add output" onClick={()=>onOpen('Add output')}/></h3><a href={location.origin} target="_blank" rel="noreferrer"><I name="globe"/>{location.host}</a></section><section><h3>Background processes</h3><p className="d-summary-process"><I name="terminal"/><span>Local UI preview</span></p></section><section><h3>Sources <B icon="plus" label="Add source" onClick={()=>onOpen('Add source')}/></h3>{files.length?files.slice(0,3).map(f=><button className="d-summary-source" key={f.url} onClick={()=>onOpen(f.name)}><img src={f.url} alt=""/><span>{f.name}</span></button>):<p className="d-summary-empty">No files attached</p>}<button className="d-summary-all" onClick={()=>onOpen('Sources')}><I name="share"/> View all</button></section></div>}

export function ConversationRail({scrollRef,messages,title}:{scrollRef:RefObject<HTMLDivElement|null>;messages:{role:string;text:string}[];title:string}){
 const[hover,setHover]=useState<number|null>(null),[active,setActive]=useState(0);
 const turns=messages.length?messages.flatMap((message,index)=>message.role==='user'?[{title:message.text,reply:messages[index+1]?.role==='assistant'?messages[index+1].text:'',index}]:[]):[{title,reply:'Referensi tampilan desktop',index:-1}];
 useEffect(()=>{const el=scrollRef.current;if(!el)return;let frame=0;const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const elements=Array.from(el.querySelectorAll<HTMLElement>('.d-chat-message-user,[data-reference-turn]'));const top=el.getBoundingClientRect().top;let nearest=0;let distance=Infinity;elements.forEach((element,index)=>{const delta=Math.abs(element.getBoundingClientRect().top-top);if(delta<distance){nearest=index;distance=delta}});setActive(nearest)})};update();el.addEventListener('scroll',update,{passive:true});return()=>{cancelAnimationFrame(frame);el.removeEventListener('scroll',update)}},[messages,scrollRef]);
 function jump(index:number){const el=scrollRef.current;if(!el)return;const target=el.querySelectorAll<HTMLElement>('.d-chat-message-user,[data-reference-turn]')[index];if(target)el.scrollTo({top:target.getBoundingClientRect().top-el.getBoundingClientRect().top+el.scrollTop,behavior:'smooth'});setActive(index)}
 return <nav className="d-turn-rail" aria-label="Conversation positions" onMouseLeave={()=>setHover(null)}>{turns.map((turn,index)=><div className="d-turn-position" key={turn.index}><button aria-label={'Jump to '+turn.title} className={active===index?'d-current':''} onMouseEnter={()=>setHover(index)} onFocus={()=>setHover(index)} onBlur={()=>setHover(null)} onClick={()=>jump(index)}><span/></button>{hover===index&&<div className="d-turn-preview"><b>{turn.title}</b><I name="bookmark" size={20}/><p>{turn.reply}</p></div>}</div>)}</nav>
}
