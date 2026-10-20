const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const esbuild=require('esbuild');
const built=esbuild.buildSync({entryPoints:['src/mobile/recordedSpeech.ts'],bundle:true,platform:'node',format:'cjs',write:false,define:{__LOCAL_PROVIDER_RELAY__:'false'}}).outputFiles[0].text;
function fixture(status=200){
 const names=['window','localStorage','sessionStorage','fetch'];const saved=Object.fromEntries(names.map(n=>[n,global[n]]));
 const data=new Map(),keys=new Map(),listeners=[],requests=[],events=[],wire=[],page=new EventTarget();
 global.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 global.sessionStorage={getItem:k=>keys.get(k)||null};
 global.window={addEventListener:page.addEventListener.bind(page),removeEventListener:page.removeEventListener.bind(page),dispatchEvent:page.dispatchEvent.bind(page),SuperGPTAudio:{addEventListener:(_,f)=>listeners.push(f),postMessage:raw=>wire.push(JSON.parse(raw))}};
 data.set('client-endpoint-profiles-v1',JSON.stringify({version:1,selectedId:'selected',profiles:[{id:'selected',name:'Fixture',baseUrl:'https://api.example.test/v1',protocol:'openai-compatible',model:'chat-model',models:[],auth:'bearer'}]}));
 keys.set('client-endpoint-keys-v1',JSON.stringify({selected:'private-test-key'}));
 data.set('client-settings-v1',JSON.stringify({dictationEngine:'endpoint',transcriptionModel:'whisper-1'}));
 global.fetch=async(url,options)=>{requests.push({url,options});return new Response(status===200?JSON.stringify({text:'Halo dari audio'}):JSON.stringify({error:'private provider body'}),{status,headers:{'content-type':'application/json'}})};
 const mod=new Module(__filename,module);mod._compile(built,__filename);
 const tick=()=>new Promise(r=>setImmediate(r));
 return {data,wire,requests,events,api:mod.exports,tick,
  start(){return mod.exports.captureRecordedSpeech({language:'id-ID',continuous:true,onStart:()=>events.push('started'),onText:s=>events.push(['text',s]),onEnd:s=>events.push(['end',s]),onError:s=>events.push(['error',s]),onProcessing:()=>events.push('processing')})},
  emit(e){listeners.forEach(f=>f({data:JSON.stringify({id:wire[0].id,...e})}))},
  restore(){for(const n of names){if(saved[n]===undefined)delete global[n];else global[n]=saved[n]}}
 };
}
test('native audio is transcribed as multipart at the selected custom endpoint, not the chat model',async()=>{
 const f=fixture();try{const capture=f.start();assert.equal(f.wire[0].op,'start');assert.deepEqual(f.events,[]);f.emit({event:'started'});const done=capture.stop();f.emit({event:'audio',data:Buffer.from('audio-fixture').toString('base64')});assert.equal(await done,'Halo dari audio');assert.equal(f.requests.length,1);const {url,options}=f.requests[0];assert.equal(url,'https://api.example.test/v1/audio/transcriptions');assert.equal(options.headers.Authorization,'Bearer private-test-key');assert.equal(options.headers['Content-Type'],undefined);assert.equal(options.body.get('model'),'whisper-1');assert.equal(options.body.get('language'),'id');assert.equal(options.body.get('file').name,'dictation.m4a');assert.deepEqual(f.events.at(-1),['end','Halo dari audio']);assert.doesNotMatch(f.data.get('client-diagnostic-log-v1'),/Halo|private-test-key|api.example/)}finally{f.restore()}
});
test('cancel before permission/startup rejects late recording and never uploads audio',async()=>{
 const f=fixture();try{const capture=f.start();capture.cancel();f.emit({event:'started'});f.emit({event:'audio',data:'YXVkaW8='});assert.equal(await capture.stop(),'');assert.equal(f.requests.length,0);assert.deepEqual(f.events,[]);assert.equal(f.wire.at(-1).op,'cancel')}finally{f.restore()}
});
test('unsupported transcription API reports actionable error and logs status without response body or key',async()=>{
 const f=fixture(404);try{const capture=f.start();f.emit({event:'started'});const done=capture.stop();f.emit({event:'audio',data:'YXVkaW8='});assert.equal(await done,'');assert.match(f.events.at(-1)[1],/HTTP 404/);assert.match(f.events.at(-1)[1],/Pengaturan/);assert.equal(f.events.filter(x=>Array.isArray(x)&&x[0]==='end').length,0);const logs=f.data.get('client-diagnostic-log-v1');assert.match(logs,/404/);assert.doesNotMatch(logs,/private-test-key|private provider body/)}finally{f.restore()}
});
test('duplicate native audio messages cannot submit duplicate API calls',async()=>{
 const f=fixture();try{const capture=f.start();f.emit({event:'started'});const done=capture.stop();f.emit({event:'audio',data:'YXVkaW8='});f.emit({event:'audio',data:'YXVkaW8='});await done;assert.equal(f.requests.length,1)}finally{f.restore()}
});
test('cancel in-flight transcription aborts HTTP and suppresses a late result',async()=>{
 const f=fixture();try{let finish;global.fetch=(url,options)=>{f.requests.push({url,options});return new Promise(r=>finish=r)};const capture=f.start();f.emit({event:'started'});const done=capture.stop();f.emit({event:'audio',data:'YXVkaW8='});capture.cancel();assert.equal(await done,'');assert.equal(f.requests[0].options.signal.aborted,true);finish(new Response('{"text":"late"}',{status:200}));await f.tick();assert.equal(f.events.some(e=>Array.isArray(e)&&e[0]==='end'),false)}finally{f.restore()}
});
test('diagnostic ring drops secrets, unknown fields and transcript-shaped error codes',()=>{
 const saved={window:global.window,localStorage:global.localStorage};const values=new Map();global.window={dispatchEvent(){}};global.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 try{const code=esbuild.buildSync({entryPoints:['src/lib/diagnosticLog.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;const m=new Module(__filename,module);m._compile(code,__filename);for(let i=0;i<305;i++)m.exports.logDiagnostic('speech','failed',{engine:'device',code:'sk-private',key:'secret',text:'transcript',url:'https://private',status:403},'error');const log=m.exports.loadDiagnosticLog();assert.equal(log.length,300);assert.deepEqual(log[0].detail,{engine:'device',status:403});m.exports.clearDiagnosticLog();assert.deepEqual(m.exports.loadDiagnosticLog(),[])}finally{global.window=saved.window;global.localStorage=saved.localStorage}
});
test('native diagnostic export shares a UTF-8 JSON file through Android, with browser fallback',async()=>{
 const saved=global.window,wire=[];
 try {
  const code=esbuild.buildSync({entryPoints:['src/mobile/openAttachment.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
  const m=new Module(__filename,module);m._compile(code,__filename);
  global.window={SuperGPTFile:{postMessage:raw=>wire.push(JSON.parse(raw))}};
  const report=JSON.stringify({event:'Pengujian suara — Indonesia'});
  assert.equal(await m.exports.shareNativeDiagnostic(report),true);
  assert.equal(wire[0].op,'share');assert.equal(wire[0].type,'application/json');assert.equal(wire[0].name,'SuperGPT-logs.json');
  assert.equal(Buffer.from(wire[0].data,'base64').toString('utf8'),report);
  global.window={};assert.equal(await m.exports.shareNativeDiagnostic(report),false);
 }finally{if(saved===undefined)delete global.window;else global.window=saved}
});
