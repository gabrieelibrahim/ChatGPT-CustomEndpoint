import {useEffect,useRef,useState} from 'react';
import {ClientButton} from '../components/SDKPrimitives';
import {connectSakelar,openSakelarBrowser,type SakelarConnection} from '../lib/sakelarConnect';
export function SakelarConnect({onConnected,disabled=false}:{onConnected:(value:SakelarConnection)=>Promise<void>;disabled?:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[code,setCode]=useState(''),[browserUrl,setBrowserUrl]=useState('');
 const active=useRef<AbortController|null>(null);
 useEffect(()=>()=>{active.current?.abort();active.current=null;},[]);
 async function start(){
  if(active.current)return;
  const controller=new AbortController();active.current=controller;setBusy(true);setMessage('');setCode('');setBrowserUrl('');
  try{await connectSakelar(controller.signal,(text,nextCode,nextUrl)=>{if(active.current===controller){setMessage(text);if(nextCode)setCode(nextCode);if(nextUrl)setBrowserUrl(nextUrl);}},onConnected);}
  catch(e){if(active.current===controller)setMessage(e instanceof Error&&e.name!=='AbortError'?e.message:controller.signal.aborted?'Koneksi dibatalkan.':'Koneksi Sakelar gagal.');}
  finally{if(active.current===controller){active.current=null;setBusy(false);setCode('');setBrowserUrl('');}}
 }
 return <section className="d-sakelar-connect" aria-label="Hubungkan akun Sakelar"><strong>Pakai akun Sakelar</strong><p>Masuk dengan Google di browser Sakelar, lalu izinkan koneksi SuperGPT. Endpoint, API key khusus 30 hari, dan model akunmu akan terisi otomatis setelah kamu kembali.</p><ClientButton type="button" disabled={busy||disabled} onClick={()=>void start()}>{busy?'Menunggu persetujuan di browser…':'Hubungkan Sakelar dengan Google'}</ClientButton>{busy&&browserUrl&&<ClientButton type="button" onClick={()=>void openSakelarBrowser(browserUrl).catch(error=>setMessage(error instanceof Error?error.message:'Browser belum dapat dibuka.'))}>Buka lagi browser Sakelar</ClientButton>}{busy&&<ClientButton type="button" onClick={()=>active.current?.abort()}>Batalkan</ClientButton>}{code&&<p>Kode pencocokan: <strong className="d-sakelar-code">{code}</strong></p>}{message&&<p role="status">{message}</p>}<small>Opsional. Pemakaian mengikuti kuota Sakelar. Kamu tetap bisa memakai endpoint sendiri. Izin Gmail/Drive dihubungkan melalui Plugin.</small></section>;
}
