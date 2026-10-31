import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Event'])globalThis[key]=key==='window'?dom.window:dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client');
const {default:Hub}=await import('../.test-artifacts/app/learning-hub.mjs');
const a={id:'a',deck_id:'d',kind:'lesson',title:'Aula A',revision:0,created:0,updated:0,payload:{steps:[{front:'Carga?',back:'-1 mA'}],index:0,answers:[],messages:[]}};
const b={...a,id:'b',title:'Aula B'};
async function fixture(fetcher,work){window.history.replaceState(null,'','/');globalThis.fetch=fetcher;const node=document.getElementById('root'),root=createRoot(node);try{await act(()=>root.render(createElement(Hub,{decks:[],aiReady:false})));await work(node);}finally{await act(()=>root.unmount());}}
async function click(node,text){const button=[...node.querySelectorAll('button')].find(b=>b.textContent.includes(text));assert.ok(button,text);await act(()=>button.click());}
test('REG-HISTORY-RACE-001: a slow earlier open cannot replace the latest selected lesson',async()=>{
 let resolveA;
 await fixture(async url=>String(url).includes('id=a')?new Promise(resolve=>{resolveA=resolve;}):Response.json(String(url).includes('id=b')?{session:b}:{sessions:[{...a,progress:0,total:1},{...b,progress:0,total:1}]}),async node=>{
  await click(node,'Aula A');await click(node,'Aula B');assert.match(node.querySelector('.learning-session').textContent,/Aula B/);
  await act(()=>resolveA(Response.json({session:a})));
  assert.match(node.querySelector('.learning-session').textContent,/Aula B/);
  assert.equal(new URL(window.location.href).searchParams.get('learning'),'b');
 });
});
test('failed lesson save retains the answer and stage; retry reuses event ID',async()=>{
 const bodies=[];
 await fixture(async(url,options={})=>{
  if(options.method==='POST'){bodies.push(JSON.parse(options.body));return Response.json({error:'Falha sintética'},{status:409});}
  return Response.json(String(url).includes('?id=')?{session:a}:{sessions:[{...a,progress:0,total:1}]});
 },async node=>{
  await click(node,'Aula A');await click(node,'Praticar sem consultar');
  const input=node.querySelector('textarea');await act(()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(input,'-1 mA');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await click(node,'Comparar com a referência');await click(node,'Entendi · avançar');
  assert.equal(node.querySelector('textarea').value,'-1 mA');assert.match(node.textContent,/0 de 1/);assert.match(node.textContent,/Falha sintética/);
  await click(node,'Entendi · avançar');assert.equal(bodies[0].eventId,bodies[1].eventId);
 });
});
