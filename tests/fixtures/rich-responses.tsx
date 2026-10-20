import '../../src/sdk-ui.css';
import '../../src/styles.css';
import '../../src/desktop/rich-text.css';
import '../../src/mobile/mobile.css';
import '../../src/mobile/theme.css';
import '../../src/mobile/media-rich-text.css';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MobileStreamingReply } from '../../src/mobile/MobileStreamingReply';
import { SafeWidget } from '../../src/agent/SafeWidget';
import '../../src/agent/agent-message.css';

const markdown = '# Respons kaya\n\nMarkdown **tebal**, *miring*, dan [tautan aman](https://example.com).\n\n```javascript\nconst total = values.reduce((sum, n) => sum + n, 0);\nconsole.log(total);\n```\n\n| Fitur | Hasil |\n| --- | --- |\n| Markdown | Aktif |\n| Formula | Aktif |\n\nInline $E=mc^2$ dan \\(a^2+b^2=c^2\\).\n\n$$\n\\int_0^1 x^2\\,dx = \\frac{1}{3}\n$$\n\n> Teks model diperlakukan sebagai data.\n\n- Daftar\n  - Bersarang\n\n' + Array.from({length:18},(_,i)=>`Paragraf ${i+1}. Respons panjang tetap dapat dibaca sambil mengalir. Blok kode dan paragraf sebelumnya mempertahankan node DOM serta tombol salinnya.\n\n`).join('');
const widget = {type:'Card',children:[{type:'Title',value:'Ringkasan terstruktur'},{type:'Row',children:[{type:'Badge',value:'Terverifikasi'},{type:'Caption',value:'Data, tanpa JavaScript model'}]},{type:'Markdown',value:'**Komponen aman** menggunakan renderer yang sama.'},{type:'Table',children:[{type:'TableRow',children:[{type:'TableCell',children:[{type:'Text',value:'Status'}]},{type:'TableCell',children:[{type:'Text',value:'Selesai'}]}]}]},{type:'Button',label:'Salin ringkasan',onClickAction:{type:'checklist.copy',payload:{text:'Ringkasan terstruktur'}}},{type:'iframe',src:'https://invalid.example'}]};
function App() {
  const [text,setText]=useState(''),[streaming,setStreaming]=useState(false),[complete,setComplete]=useState(''),[epoch,setEpoch]=useState(0);
  useEffect(()=>{if(!epoch)return;let at=0;setText('');setStreaming(true);setComplete('');const timer=setInterval(()=>{at=Math.min(markdown.length,at+90);setText(markdown.slice(0,at));if(at===markdown.length){clearInterval(timer);setStreaming(false);setComplete(String(epoch));}},35);return()=>clearInterval(timer);},[epoch]);
  return <div className="m-app" style={{position:'relative',minHeight:'100vh',height:'auto',overflow:'visible',padding:'16px'}}><header style={{display:'flex',gap:12,alignItems:'center',marginBottom:20}}><button onClick={()=>setEpoch(n=>n+1)}>Mulai streaming</button><span role="status">{streaming?'Streaming…':complete?'Selesai':'Siap'}</span></header><article className="m-message m-assistant" style={{margin:0}}><MobileStreamingReply text={text} streaming={streaming} completionId={complete}/></article>{complete&&<SafeWidget widget={widget} state={{active:false,pending:false,items:[],sources:[]}} itemId="fixture"/>}</div>;
}
document.documentElement.dataset.clientTheme='light';
createRoot(document.getElementById('fixture')!).render(<App/>);
