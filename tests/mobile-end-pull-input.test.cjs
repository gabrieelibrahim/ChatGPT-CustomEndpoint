const test = require('node:test'), assert = require('node:assert/strict'), Module = require('node:module');
const built = require('esbuild').buildSync({ entryPoints: ['src/mobile/MobileEndPull.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react', 'react-dom', 'react/jsx-runtime'] }).outputFiles[0].text;

test('scroll momentum arriving at the bottom never becomes a new-chat gesture; a fresh overdrag can start there', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previous = Object.fromEntries(['window','document','Element','requestAnimationFrame','cancelAnimationFrame'].map(key => [key,global[key]]));
  const values = new Map(), jobs = new Map(); let serial = 0, cleanup;
  class FakeElement extends EventTarget {
    style = { setProperty: (key,value) => values.set(key,value), removeProperty: key => values.delete(key) }; dataset = {}; clientHeight = 500; scrollHeight = 1000; scrollTop = 0;
    closest() { return null; } querySelector() { return stack; }
  }
  const stack = new FakeElement(), scroll = new FakeElement(); scroll.parentElement = new FakeElement();
  global.Element = FakeElement; global.window = new EventTarget(); window.matchMedia = () => ({ matches: false }); global.document = { documentElement: { dataset: {} } };
  global.requestAnimationFrame = fn => { jobs.set(++serial,fn); return serial; }; global.cancelAnimationFrame = id => jobs.delete(id);
  const hooks = { useState: () => [null,()=>{}], useRef: value => ({ current:value }), useEffect(fn) { cleanup = fn(); } };
  const mod = new Module(__filename+'.fixture',module); mod.paths = module.paths;
  mod.require = key => key === 'react' ? hooks : key === 'react-dom' ? {createPortal: node => node} : require(key); mod._compile(built,__filename);
  const wheel = deltaY => { const event = Object.assign(new Event('wheel',{cancelable:true}),{deltaY,deltaX:0,deltaMode:0,ctrlKey:false}); scroll.dispatchEvent(event); return event; };
  try {
    mod.exports.MobileEndPull({ scroll:{current:scroll}, enabled:true, conversation:'Fixture', onNew:()=>assert.fail('No release has committed') });
    assert.equal(wheel(600).defaultPrevented,false);
    scroll.scrollTop = 500;
    assert.equal(wheel(600).defaultPrevented,false,'momentum stays normal scrolling after reaching the edge');
    assert.equal(values.get('--m-pull-offset'),undefined);
    t.mock.timers.tick(141);
    assert.equal(wheel(150).defaultPrevented,true,'fresh gesture at edge is claimed');
    assert.ok(parseFloat(values.get('--m-pull-offset')) > 0);
    assert.equal(scroll.scrollHeight,1000,'revealing does not append layout content');
    cleanup(); cleanup = null; assert.equal(values.has('--m-pull-offset'),false); assert.equal(jobs.size,0);
    assert.equal(wheel(150).defaultPrevented,false,'listeners are removed');
  } finally { cleanup?.(); for (const [key,value] of Object.entries(previous)) { if(value===undefined)delete global[key];else global[key]=value; } }
});
