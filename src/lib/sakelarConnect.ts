import {isNativeDesktop} from './nativeDesktop';
import {discoverEndpointModels} from './endpointProfiles';

export const sakelarOrigin='https://app.sakelar.web.id';
export const sakelarBaseUrl='https://api.sakelar.web.id/v1';
export type SakelarConnection={apiKey:string;keyId:string;expiresAt:string;models:string[]};
const pattern=/^[A-Za-z0-9_-]{43}$/;
const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function request(action:string,signal:AbortSignal,body?:object){
 const fetcher=isNativeDesktop()?(await import('@tauri-apps/plugin-http')).fetch:fetch;
 return fetcher(sakelarOrigin+'/api/supergpt/'+action,{method:body?'POST':'GET',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',...(isNativeDesktop()?{maxRedirections:0}:{})});
}
async function json(response:Response){
 if(!response.headers.get('content-type')?.includes('application/json')){await response.body?.cancel();throw Error('Koneksi otomatis Sakelar belum tersedia pada server.');}
 if(!response.body)throw Error('Respons Sakelar kosong.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let raw='',size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8192)throw Error('Respons Sakelar terlalu besar.');raw+=decoder.decode(part.value,{stream:true});}return JSON.parse(raw+decoder.decode());}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
function delay(signal:AbortSignal,ms:number){return new Promise<void>((resolve,reject)=>{
 const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(Error('Koneksi Sakelar dibatalkan.'));};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
});}
// Browser login remains at Sakelar. SuperGPT receives only its own key after explicit consent.
export async function connectSakelar(signal:AbortSignal,progress:(message:string,code?:string)=>void,commit:(connection:SakelarConnection)=>Promise<void>){
 signal.throwIfAborted();
 const native=isNativeDesktop();
 const popup=!native?window.open('about:blank','_blank','popup,width=520,height=740'):undefined;
 if(popup)popup.opener=null;
 if(!native&&!popup)throw Error('Izinkan jendela login Sakelar, lalu coba lagi.');
 const deadline=AbortSignal.any([signal,AbortSignal.timeout(600000)]);
 let deviceCode='',verifier='',completed=false;
 try{
  progress('Memeriksa koneksi Sakelar…');
  const configResponse=await request('config',deadline),config=await json(configResponse);
  if(!configResponse.ok||config.ready!==true||config.version!==1||config.baseUrl!==sakelarBaseUrl)throw Error('Koneksi otomatis Sakelar belum diaktifkan. Gunakan API key manual untuk sementara.');
  verifier=random();
  const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const startResponse=await request('start',deadline,{challenge}),start=await json(startResponse);
  if(!startResponse.ok)throw Error(startResponse.status===429?'Terlalu banyak percobaan. Tunggu sebelum menghubungkan lagi.':'Permintaan koneksi Sakelar gagal.');
  if(typeof start.deviceCode!=='string'||!pattern.test(start.deviceCode))throw Error('Respons koneksi Sakelar tidak valid.');
  deviceCode=start.deviceCode;
  if(typeof start.userCode!=='string'||!/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(start.userCode)||start.expiresIn!==600||start.interval!==3)throw Error('Kode koneksi Sakelar tidak valid.');
  const url=new URL(start.verificationUri);
  if(url.origin!==sakelarOrigin||url.pathname!=='/console/connectsupergpt'||url.username||url.password||url.hash||url.searchParams.size!==1||url.searchParams.get('code')!==start.userCode)throw Error('Tujuan login Sakelar tidak sesuai.');
  progress('Cocokkan kode, login Google di Sakelar, lalu izinkan koneksi. Kembali ke SuperGPT setelah selesai.',start.userCode);
  if(popup)popup.location.href=url.href;else await (await import('@tauri-apps/plugin-opener')).openUrl(url.href);
  for(;;){
   await delay(deadline,3000);deadline.throwIfAborted();
   if(popup?.closed)throw Error('Jendela login Sakelar ditutup. Mulai lagi untuk menghubungkan.');
   const response=await request('token',deadline,{deviceCode,verifier});
   if(response.status===202){await response.body?.cancel();continue;}
   if(!response.ok){await response.body?.cancel();throw Error(response.status===403?'Koneksi ditolak atau akun tidak tersedia.':response.status===429?'Batas percobaan Sakelar tercapai. Mulai lagi nanti.':'Kode koneksi sudah berakhir atau hasilnya belum terkonfirmasi. Mulai lagi dari SuperGPT.');}
   const value=await json(response);
   if(value.baseUrl!==sakelarBaseUrl||typeof value.apiKey!=='string'||!/^sk_(?:live|thin)_[A-Za-z0-9_-]{43}$/.test(value.apiKey)||typeof value.keyId!=='string'||!/^[0-9a-f-]{36}$/i.test(value.keyId)||!Number.isFinite(Date.parse(value.expiresAt))||Date.parse(value.expiresAt)<=Date.now())throw Error('Kredensial Sakelar tidak valid.');
   deadline.throwIfAborted();progress('Mengambil model yang tersedia untuk akunmu…');
   const models=await discoverEndpointModels(sakelarBaseUrl,value.apiKey,deadline);
   if(!models.length)throw Error('Belum ada model yang dapat dipakai akun ini. Periksa akses model Sakelar lalu hubungkan lagi.');
   deadline.throwIfAborted();await commit({apiKey:value.apiKey,keyId:value.keyId,expiresAt:value.expiresAt,models});
   completed=true;progress('Sakelar terhubung. Endpoint dan model sudah terisi.');return;
  }
 }finally{
  popup?.close();
  if(!completed&&deviceCode&&verifier)await request('cancel',AbortSignal.timeout(5000),{deviceCode,verifier}).then(async r=>{await r.body?.cancel();if(!r.ok)throw Error('cleanup_failed');}).catch(()=>{throw Error('Koneksi belum selesai dan pembersihan belum terkonfirmasi. Jika ada key SuperGPT baru pada konsol Sakelar, cabut key tersebut sebelum mencoba lagi.');});
 }
}
