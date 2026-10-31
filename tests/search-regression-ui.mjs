import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','Event','MouseEvent','localStorage'])globalThis[key]=key==='window'?dom.window:dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.clearInterval=dom.window.clearInterval.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createElement,act}=await import('react');
const {createRoot}=await import('react-dom/client');
const {default:Lume}=await import('../.test-artifacts/app/lume.mjs');
test('REG-SEARCH-001: pasted deck search ignores boundary whitespace and accents',async()=>{
 const state={name:'Prévia local',decks:[{id:'d',title:'Revisão de investimento',description:'',color:'green',source:''}],cards:[],reviews:[],messages:[],aiReady:false};
 globalThis.fetch=async url=>Response.json(String(url).includes('/learning')?{sessions:[]}:state);
 const node=document.getElementById('root'),root=createRoot(node);
 try{
  await act(()=>root.render(createElement(Lume)));
  const input=node.querySelector('[aria-label="Buscar baralhos"]');
  await act(()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'  revisao  ');input.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(node.querySelectorAll('button.deck').length,1);
 }finally{await act(()=>root.unmount());}
});
