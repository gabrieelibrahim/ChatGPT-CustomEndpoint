const test = require('node:test'), assert = require('node:assert/strict'), Module = require('node:module');
const { buildSync } = require('esbuild');
function load(entry, extra = {}) { const build = buildSync({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',loader:{'.css':'empty','.module.css':'empty'},external:['react','react-dom','react/jsx-runtime'],...extra}); const m = new Module(__filename+'.fixture',module);m.paths=module.paths;m._compile(build.outputFiles[0].text,__filename);return m.exports; }

test('haptics finish short and medium replies once, throttle long streams, and respect mute',()=>{
  const {createStreamHaptics}=load('src/mobile/streamHaptics.ts'); let now=0; const pulses=[];
  const short=createStreamHaptics(x=>pulses.push(x),()=>now);short.progress('short');short.progress('x'.repeat(2500));assert.deepEqual(pulses,[]);short.complete();short.complete();assert.deepEqual(pulses,['complete']);
  pulses.length=0;const long=createStreamHaptics(x=>pulses.push(x),()=>now);long.progress('x'.repeat(3000));now=100;long.progress('x'.repeat(3300));now=950;long.progress('x'.repeat(3400));now=2000;long.progress('x'.repeat(3450));long.complete();assert.deepEqual(pulses,['tick','tick','complete']);
  pulses.length=0;const muted=createStreamHaptics(x=>pulses.push(x),()=>now);muted.progress('x'.repeat(5000),false);muted.complete(false);assert.deepEqual(pulses,[]);
});

test('rich blocks preserve stable prefixes and document-wide reference semantics',()=>{
  const {richMarkdownBlocks,normalizeMathDelimiters}=load('src/components/richMarkdown.ts');
  const prefix='# Heading\n\n```js\nconst n = 1;\n```\n\n';
  const before=richMarkdownBlocks(prefix+'Growing'), after=richMarkdownBlocks(prefix+'Growing paragraph with **strong** text.');
  assert.deepEqual(before.slice(0,2),after.slice(0,2));assert.equal(after[1].text,'```js\nconst n = 1;\n```');
  const references='See [guide][g].\n\nAnother block.\n\n[g]: https://example.com';assert.deepEqual(richMarkdownBlocks(references),[{key:0,text:references}]);
  const math='Inline \\(x^2\\), `\\(literal\\)`\n\n```tex\n\\[code\\]\n```\n\n\\[x+y\\]';
  const normalized=normalizeMathDelimiters(math);assert.ok(normalized.includes('$x^2$'));assert.ok(normalized.includes('`\\(literal\\)`'));assert.ok(normalized.includes('\\[code\\]'));assert.ok(normalized.includes('$$\nx+y\n$$'));
  const nested='> ```tex\n> \\(literal\\)\n> ```\n\n- Example:\n\n    ```tex\n    \\[literal\\]\n    ```';assert.equal(normalizeMathDelimiters(nested),nested);
});

test('SDK math renders inline/display TeX and blocks active math URLs',()=>{
  const {renderToStaticMarkup}=require('react-dom/server'),React=require('react');
  const Renderer=load('src/components/RichTextRenderer.tsx').default;
  const html=renderToStaticMarkup(React.createElement(Renderer,{text:'Inline $x^2$ and \\(a+b\\).\n\n$$\n\\frac{1}{2}\n$$\n\n$\\href{javascript:alert(1)}{bad}$'}));
  assert.ok(html.includes('katex'));assert.ok(html.includes('katex-display'));assert.ok(!html.includes('href="javascript:'));assert.ok(!html.includes('<script'));
});

test('structured widgets reject cyclic/deep data, unsafe actions, objects as text and unknown types',()=>{
  const {sanitizeWidget}=load('src/agent/safeWidgets.ts');
  const input={type:'Card',children:[{type:'Title',value:'Report'},{type:'Row',children:[{type:'Text',value:'Safe'}]},{type:'Button',label:'Run',onClickAction:{type:'exec',payload:{command:'evil'}}},{type:'iframe',src:'https://evil.test'}]};
  const result=sanitizeWidget(input);assert.equal(result.children[0].value,'Report');assert.equal(result.children[2].action,undefined);assert.equal(result.children[3].type,'Unsupported');
  const cycle={type:'Card',children:[]};cycle.children.push(cycle);assert.equal(sanitizeWidget(cycle).type,'Unsupported');
  assert.equal(sanitizeWidget({type:'Text',value:{html:'<script>'}}).type,'Unsupported');
  assert.equal(sanitizeWidget({type:'Table',children:[{type:'Text',value:'Invalid row'}]}).type,'Unsupported');
  assert.equal(sanitizeWidget({type:'Card',children:[{type:'TableCell',children:[]}]}).type,'Unsupported');
  let deep={type:'Text',value:'end'};for(let i=0;i<30;i++)deep={type:'Box',children:[deep]};assert.equal(sanitizeWidget(deep).type,'Unsupported');
  assert.equal(sanitizeWidget({type:'Card',children:Array.from({length:300},()=>({type:'Text',value:'n'}))}).type,'Unsupported');
  const {safeAgentItem}=load('src/agent/agentItem.ts');assert.equal(safeAgentItem({id:'x',type:'structured_input',inputs:[{id:'q',question:{script:'bad'}}]}),null);assert.equal(safeAgentItem({id:'x',type:'generated_image',image:{url:'javascript:alert(1)'}}),null);
});

test('release tooling uses one APK name and stable latest releases and rejects version mismatch',async()=>{
  const {releaseArguments,validateApkMetadata}=await import('../scripts/publishAndroidRelease.mjs');
  const args=releaseArguments('v1.2.0','/tmp/SuperGPT.apk','/tmp/SHA256SUMS.txt','/tmp/notes.md');assert.ok(args.includes('--prerelease=false'));assert.ok(args.includes('--latest'));assert.ok(args.includes('--verify-tag'));assert.ok(!args.includes('--draft'));
  assert.throws(()=>releaseArguments('v1.2.0-beta','a','b','c'));
  validateApkMetadata('v1.2.0',"package: name='id.sakelar.client.debug' versionCode='1200' versionName='1.2.0'\nnative-code: 'arm64-v8a'");
  assert.throws(()=>validateApkMetadata('v1.2.0',"package: name='id.sakelar.client.debug' versionName='1.1.0'\nnative-code: 'arm64-v8a'"));
});

test('safe structured renderer displays nested tables and escapes hostile values without interactive unknown actions',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const {SafeWidget}=load('src/agent/SafeWidget.tsx');
  const html=renderToStaticMarkup(React.createElement(SafeWidget,{state:{active:false,pending:false,items:[],sources:[]},itemId:'safe',widget:{type:'Card',children:[{type:'Title',value:'<script>evil()</script>'},{type:'Table',children:[{type:'TableRow',children:[{type:'TableCell',children:[{type:'Text',value:'Value'}]}]}]},{type:'Button',label:'Execute',onClickAction:{type:'exec',payload:{js:'evil()'}}},{type:'iframe',src:'https://evil.test'}]}}));
  assert.ok(html.includes('<table>'));assert.ok(html.includes('<td>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<iframe'));assert.ok(html.includes('disabled=""'));assert.ok(html.includes('belum didukung'));
});
