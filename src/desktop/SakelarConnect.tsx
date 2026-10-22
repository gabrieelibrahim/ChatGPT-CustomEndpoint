import {useEffect,useRef,useState} from 'react';
import {ClientButton} from '../components/SDKPrimitives';
import {connectSakelar,type SakelarConnection} from '../lib/sakelarConnect';
export function SakelarConnect({onConnected,disabled=false}:{onConnected:(value:SakelarConnection)=>Promise<void>;disabled?:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[code,setCode]=useState('');
 const active=useRef<AbortController|null>(null);
 useEffect(()=>()=>{active.current?.abort();active.current=null;},[]);
 async function start(){
  if(active.current)return;
  const controller=new AbortController();active.current=controller;setBusy(true);setMessage('');setCode('');
  try{await connectSakelar(controller.signal,(text,nextCode)=>{if(active.current===controller){setMessage(text);if(nextCode)setCode(nextCode);}},onConnected);}
  catch(e){if(active.current===controller)setMessage(e instanceof Error&&e.name!=='AbortError'?e.message:controller.signal.aborted?'Koneksi dibatalkan.':'Koneksi Sakelar gagal.');}
  finally{if(active.current===controller){active.current=null;setBusy(false);setCode('');}}
 }
 return <section className="d-sakelar-connect" aria-label="Hubungkan akun Sakelar"><strong>Pakai akun Sakelar</strong><p>Login Google melalui Sakelar untuk mengisi endpoint dan API key khusus SuperGPT secara otomatis. Key berlaku 30 hari; pemakaian mengikuti kuota akun Sakelar.</p><ClientButton type="button" disabled={busy||disabled} onClick={()=>void start()}>{busy?'Menunggu koneksi…':'Hubungkan Sakelar dengan Google'}</ClientButton>{busy&&<ClientButton type="button" onClick={()=>active.current?.abort()}>Batalkan</ClientButton>}{code&&<p>Kode pencocokan: <strong className="d-sakelar-code">{code}</strong></p>}{message&&<p role="status">{message}</p>}<small>Opsional. Kamu tetap bisa memakai endpoint sendiri. Izin Gmail/Drive dihubungkan melalui Plugin.</small></section>;
}
