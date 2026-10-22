import {isNativeDesktop} from './nativeDesktop';
import {discoverEndpointModels} from './endpointProfiles';

export const sakelarOrigin='https://app.sakelar.web.id';
export const sakelarBaseUrl='https://api.sakelar.web.id/v1';
export type SakelarConnection={apiKey:string;keyId:string;expiresAt:string;models:string[]};
const pattern=/^[A-Za-z0-9_-]{43}$/;
const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function request(action:'start'|'token'|'cancel',signal:AbortSignal,body:object){
 const native=isNativeDesktop(),fetcher=native?(await import('@tauri-apps/plugin-http')).fetch:fetch;
 // Native requests use the proof-bound API directly; browser requests use the same-origin proxy.
 const endpoint=native?'https://api.sakelar.web.id/auth/supergpt/':sakelarOrigin+'/api/supergpt/';
 return fetcher(endpoint+action,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',...(native?{maxRedirections:0}:{})});
}
function connectionError(response:Response,value:unknown):Error{
 const code=(value as {error?:{code?:unknown}})?.error?.code;
 return Error(response.status===429?'Terlalu banyak percobaan. Tunggu sebelum menghubungkan lagi.':response.status===403&&code==='invalid_origin'?'Server Sakelar menolak asal aplikasi. Konfigurasi koneksi aplikasi perlu diperbarui.':response.status===503||code==='connect_not_configured'?'Layanan koneksi Sakelar belum siap. Login browser belum dapat dimulai; coba lagi sebentar.':'Permintaan koneksi Sakelar gagal (HTTP '+response.status+'). Coba lagi.');
}
function verifiedBrowserUrl(value:string){
 const url=new URL(value);
 if(url.origin!==sakelarOrigin||url.pathname!=='/console/connectsupergpt'||url.username||url.password||url.hash||url.searchParams.size!==1||!/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(url.searchParams.get('code')||''))throw Error('Tujuan login Sakelar tidak sesuai.');
 return url.href;
}
export async function openSakelarBrowser(value:string){
 const target=verifiedBrowserUrl(value);
 if(isNativeDesktop())await(await import('@tauri-apps/plugin-opener')).openUrl(target);
 else{
  const popup=window.open('about:blank','_blank','popup,width=520,height=740');
  if(!popup)throw Error('Izinkan browser membuka halaman Sakelar, lalu coba lagi.');
  popup.opener=null;popup.location.href=target;
 }
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
export async function connectSakelar(signal:AbortSignal,progress:(message:string,code?:string,browserUrl?:string)=>void,commit:(connection:SakelarConnection)=>Promise<void>){
 signal.throwIfAborted();
 const native=isNativeDesktop();
 const popup=!native?window.open('about:blank','_blank','popup,width=520,height=740'):undefined;
 if(popup)popup.opener=null;
 if(!native&&!popup)throw Error('Izinkan jendela login Sakelar, lalu coba lagi.');
 const deadline=AbortSignal.any([signal,AbortSignal.timeout(600000)]);
 let deviceCode='',verifier='',completed=false,failure:unknown;
 try{
  progress('Menyiapkan login browser Sakelar…');
  verifier=random();
  const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const startResponse=await request('start',deadline,{challenge}),start=await json(startResponse);
  if(!startResponse.ok)throw connectionError(startResponse,start);
  if(typeof start.deviceCode!=='string'||!pattern.test(start.deviceCode))throw Error('Respons koneksi Sakelar tidak valid.');
  deviceCode=start.deviceCode;
  if(typeof start.userCode!=='string'||!/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(start.userCode)||start.expiresIn!==600||start.interval!==3)throw Error('Kode koneksi Sakelar tidak valid.');
  if(typeof start.verificationUri!=='string')throw Error('Tujuan login Sakelar tidak sesuai.');
  const target=verifiedBrowserUrl(start.verificationUri);
  if(new URL(target).searchParams.get('code')!==start.userCode)throw Error('Kode login Sakelar tidak sesuai.');
  progress('Membuka browser. Login Google di Sakelar, cocokkan kode, lalu pilih Izinkan koneksi SuperGPT. Setelah itu kembali ke aplikasi.',start.userCode,target);
  deadline.throwIfAborted();
  if(popup)popup.location.href=target;else await openSakelarBrowser(target);
  for(;;){
   await delay(deadline,3000);deadline.throwIfAborted();
   // Closing the browser after consent is a normal way to return to the app.
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
 }catch(error){failure=error;throw error;}finally{
  popup?.close();
  if(!completed&&deviceCode&&verifier)await request('cancel',AbortSignal.timeout(5000),{deviceCode,verifier}).then(async r=>{await r.body?.cancel();if(!r.ok)throw Error('cleanup_failed');}).catch(()=>{throw Error((failure instanceof Error?failure.message+' ':'')+'Pembersihan koneksi belum terkonfirmasi. Jika ada key SuperGPT baru pada konsol Sakelar, cabut key tersebut sebelum mencoba lagi.');});
 }
}
