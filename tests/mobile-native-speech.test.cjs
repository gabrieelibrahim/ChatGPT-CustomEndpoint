const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const built = require('esbuild').buildSync({entryPoints:['src/mobile/speechCapture.ts'],bundle:true,write:false,platform:'node',format:'cjs'}).outputFiles[0].text;
function fixture() {
  const previous = global.window, listeners = [], messages = [], events = [], captures = [], page = new EventTarget();
  global.window = { SuperGPTSpeech: {
    addEventListener: (_, listener) => listeners.push(listener),
    postMessage: raw => messages.push(JSON.parse(raw)),
  }, SpeechRecognition: class { constructor() { throw Error('Native bridge must be preferred.'); } },
    addEventListener:page.addEventListener.bind(page),removeEventListener:page.removeEventListener.bind(page),
  };
  const mod = new Module(__filename+'.fixture',module); mod._compile(built,__filename);
  return {
    messages, events, listeners,
    hide() { page.dispatchEvent(new Event('pagehide')); },
    start() { const capture = mod.exports.captureSpeech({ language:'id-ID',continuous:true,
      onStart(){events.push(['started']);},onText(value){events.push(['text',value]);},
      onLevel(value){events.push(['level',value]);},onEnd(value){events.push(['end',value]);},onError(value){events.push(['error',value]);},
      onProcessing(){events.push(['processing']);},
    }); captures.push(capture);return capture; },
    emit(value) { listeners.forEach(listener => listener({data:JSON.stringify(value)})); },
    restore() { captures.forEach(capture=>capture.cancel());if(previous===undefined)delete global.window;else global.window=previous; },
  };
}
test('native dictation waits for readiness, replaces partial text, and stop waits for the final result',async()=>{
  const f=fixture();try {
    const capture=f.start(),id=f.messages[0].id;
    assert.equal(f.messages[0].op,'start');assert.equal(f.messages[0].language,'id-ID');assert.deepEqual(f.events,[]);
    f.emit({id,event:'started'});f.emit({id,event:'started'});
    f.emit({id,event:'text',text:'Halo dun'});f.emit({id,event:'text',text:'Halo dunia'});
    f.emit({id,event:'level',level:2});f.emit({id,event:'level',level:-2});
    const done=capture.stop();assert.equal(capture.stop(),done);assert.equal(f.messages.at(-1).op,'stop');
    f.emit({id,event:'processing'});assert.deepEqual(f.events.at(-1),['processing']);
    f.emit({id,event:'end',text:'Halo dunia!'});
    assert.equal(await done,'Halo dunia!');assert.equal(f.events.filter(([kind])=>kind==='started').length,1);
    assert.deepEqual(f.events.at(-1),['end','Halo dunia!']);
    assert.deepEqual(f.events.filter(([kind])=>kind==='level'),[['level',1],['level',0]]);
  } finally { f.restore(); }
});
test('cancel during permission/startup invalidates late readiness and results without accepting text',async()=>{
  const f=fixture();try {
    const capture=f.start(),id=f.messages[0].id;
    const done=capture.stop();capture.cancel();
    f.emit({id,event:'started'});f.emit({id,event:'text',text:'Late'});f.emit({id,event:'processing'});f.emit({id,event:'end',text:'Late'});
    assert.equal(await done,'');assert.equal(await capture.stop(),'');assert.deepEqual(f.events,[]);
    assert.deepEqual(f.messages.map(value=>value.op),['start','stop','cancel']);
  } finally { f.restore(); }
});
test('native permission/error ends a request without returning interim text or accepting a late final result',async()=>{
  const f=fixture();try {
    const capture=f.start(),id=f.messages[0].id;
    f.emit({id,event:'text',text:'Discard on error'});const done=capture.stop();
    f.emit({id,event:'error',code:'not-allowed'});f.emit({id,event:'end',text:'Late'});
    assert.equal(await done,'');assert.match(f.events.at(-1)[1],/Izin mikrofon ditolak/);
    assert.equal(f.events.filter(([kind])=>kind==='end').length,0);
  } finally { f.restore(); }
});
test('bridge routes concurrent session IDs and ignores unknown or malformed replies',()=>{
  const f=fixture();try {
    f.start();const first=f.messages[0].id;f.start();const second=f.messages[1].id;
    assert.notEqual(first,second);assert.equal(f.listeners.length,1);
    f.emit({id:'unknown',event:'started'});f.listeners[0]({data:'not json'});f.emit({id:first,event:'level',level:'bad'});
    assert.deepEqual(f.events,[]);
    f.emit({id:first,event:'error',code:'interrupted'});f.emit({id:second,event:'started'});
    assert.match(f.events[0][1],/aplikasi ditinggalkan/);assert.deepEqual(f.events.at(-1),['started']);
  } finally { f.restore(); }
});
test('stop before any partial result accepts the eventual final transcript; a late started event cannot claim recording',async()=>{
  const f=fixture();try {
    const capture=f.start(),id=f.messages[0].id;const done=capture.stop();
    f.emit({id,event:'started'});assert.deepEqual(f.events,[]);
    f.emit({id,event:'end',text:'Final tanpa partial'});assert.equal(await done,'Final tanpa partial');
  } finally { f.restore(); }
});
test('missing final reply times out and cancels native capture; late readiness cannot disable the stop deadline',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const f=fixture();try {
    const capture=f.start(),id=f.messages[0].id;const done=capture.stop();
    f.emit({id,event:'started'});t.mock.timers.tick(16001);
    assert.equal(await done,'');assert.equal(f.messages.at(-1).op,'cancel');
    assert.equal(f.events.filter(([kind])=>kind==='error').length,1);
    f.emit({id,event:'end',text:'Too late'});assert.equal(f.events.filter(([kind])=>kind==='end').length,0);
  } finally { f.restore(); t.mock.timers.reset(); }
});
test('page unload cancels native capture before discarding its bridge listeners',async()=>{
  const f=fixture();try {
    const capture=f.start(),id=f.messages[0].id;f.emit({id,event:'started'});f.hide();
    assert.equal(f.messages.at(-1).op,'cancel');f.emit({id,event:'end',text:'Unloaded'});
    assert.equal(await capture.stop(),'');assert.equal(f.events.filter(([kind])=>kind==='end').length,0);
    const count=f.messages.length;f.hide();assert.equal(f.messages.length,count);
  } finally { f.restore(); }
});
