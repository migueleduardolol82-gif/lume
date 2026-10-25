import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','HTMLTextAreaElement','Event','MouseEvent'])globalThis[key]=key==='window'?dom.window:dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.fetch=async()=>Response.json({notes:[],files:[]});
const {createElement,act}=await import('react');
const {createRoot}=await import('react-dom/client');
const {default:DeckWorkspace}=await import('../.test-artifacts/app/deck-workspace.mjs');
const deck={id:'deck',title:'Test',description:'',color:'green',source:'Original notes'};
const cards=Array.from({length:25},(_,i)=>({id:String(i),deck_id:'deck',front:'Question '+i,back:'Answer '+i,due:0,interval:0,revision:0}));
async function fixture(run,overrides={}){
 const node=document.getElementById('root'),root=createRoot(node),studied=[];
 const noop=()=>{};
 try{await act(()=>root.render(createElement(DeckWorkspace,{deck,cards,busy:false,onStudy:list=>studied.push(list),onEdit:noop,onDelete:noop,onAdd:noop,onImport:noop,onGenerate:noop,onEditCard:noop,onDeleteCard:noop,onSaveNotes:async()=>true,...overrides})));await run(node,studied);}finally{await act(()=>root.unmount());}
}
async function click(node,text){const button=[...node.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert.ok(button,'Button missing: '+text);await act(()=>button.click());}
async function draft(node){await click(node,'Editar notas');const textarea=node.querySelector('textarea');assert.ok(textarea);await act(()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(textarea,'Unsaved draft');textarea.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});assert.equal(textarea.value,'Unsaved draft');}
test('REG-UI-001: unsaved notes survive Materials → Path → Materials',async()=>fixture(async node=>{
 await draft(node);await click(node,'Caminho');await click(node,'Materiais');assert.equal(node.querySelector('textarea')?.value,'Unsaved draft');
}));
test('REG-UI-001: closing and reopening the notes editor keeps the draft',async()=>fixture(async node=>{
 await draft(node);await click(node,'Fechar editor');await click(node,'Editar notas');assert.equal(node.querySelector('textarea')?.value,'Unsaved draft');
}));
test('study path starts only the selected five-card final stage',async()=>fixture(async(node,studied)=>{
 await click(node,'Caminho');const button=node.querySelector('[aria-label="Etapa 3: 5 cartões, 5 para revisar"]');assert.ok(button);await act(()=>button.click());assert.equal(studied.length,1);assert.deepEqual(studied[0].map(c=>c.id),['20','21','22','23','24']);
}));
test('starting study cannot silently discard unsaved notes',async()=>fixture(async(node,studied)=>{
 await draft(node);await click(node,'Caminho');const button=node.querySelector('[aria-label="Etapa 1: 10 cartões, 10 para revisar"]');await act(()=>button.click());assert.equal(studied.length,0);assert.equal(node.querySelector('textarea').value,'Unsaved draft');assert.match(node.textContent,/Salve suas notas/);
}));
test('Materials shows five previews, expands all cards and filters without changing the deck',async()=>fixture(async node=>{
 assert.equal(node.querySelectorAll('.reference-cards article').length,5);
 await click(node,'Ver todos os 25 cartões');assert.equal(node.querySelectorAll('.reference-cards article').length,25);
 const input=node.querySelector('input[aria-label="Buscar cartões neste baralho"]');
 await act(()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'Question 24');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 assert.equal(node.querySelectorAll('.reference-cards article').length,1);assert.match(node.querySelector('.reference-cards').textContent,/Answer 24/);assert.equal(cards.length,25);
}));
test('Path and Materials tabs support keyboard selection and focus',async()=>fixture(async node=>{
 const materials=node.querySelector('#materials-tab');await act(()=>materials.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
 assert.equal(node.querySelector('#path-tab').getAttribute('aria-selected'),'true');assert.equal(document.activeElement.id,'path-tab');
 await act(()=>document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'End',bubbles:true})));
 assert.equal(materials.getAttribute('aria-selected'),'true');assert.equal(document.activeElement,materials);
}));
test('subdeck cards open the correct child and unsaved notes block navigation',async()=>{
 const opened=[];
 await fixture(async node=>{await click(node,'Child8 cartões');assert.deepEqual(opened,['child']);await draft(node);await click(node,'Child8 cartões');await click(node,'Novo subbaralho');assert.deepEqual(opened,['child']);assert.match(node.textContent,/Salve suas notas/);},
 {subdecks:[{...deck,id:'child',title:'Child',cardCount:8}],onOpenSubdeck:id=>opened.push(id),onAddSubdeck:()=>opened.push('new')});
});
