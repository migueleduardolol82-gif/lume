import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Event','MouseEvent'])globalThis[key]=key==='window'?dom.window:dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.localStorage=dom.window.localStorage;
const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client');
const {default:Library}=await import('../.test-artifacts/app/material-library.mjs');
const {default:DeckMaterials}=await import('../.test-artifacts/app/deck-materials.mjs');
const {default:CardEditor}=await import('../.test-artifacts/app/card-editor.mjs');
const {default:GenerateCards}=await import('../.test-artifacts/app/generate-cards.mjs');
const {draftKey}=await import('../.test-artifacts/lib/drafts.mjs');
const {uploadMaterialFile}=await import('../.test-artifacts/lib/material-files.mjs');
const notes=[{id:'a',deck_id:'deck',title:'Nota A',content:'Original A',revision:0,created:0,updated:0},{id:'b',deck_id:'deck',title:'Nota B',content:'Original B',revision:0,created:0,updated:0}];
async function fixture(run){let historyCalls=0;globalThis.fetch=async url=>{if(String(url).includes('&id=')){historyCalls++;return Response.json({versions:[{revision:0,title:'Nota B',content:'Original B',created:0}]});}return Response.json({notes,files:[]});};const node=document.getElementById('root'),root=createRoot(node);try{await act(async()=>{root.render(createElement(Library,{deckId:'deck',busy:false}));});await run(node,()=>historyCalls);}finally{await act(()=>root.unmount());}}
async function button(node,text,index=0){const candidates=[...node.querySelectorAll('button')].filter(b=>b.textContent.trim()===text);assert.ok(candidates[index]);await act(async()=>{candidates[index].click();});}
async function edit(node){await button(node,'Editar');const input=node.querySelector('textarea');await act(()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(input,'Rascunho não salvo');input.dispatchEvent(new Event('input',{bubbles:true}));});}
test('REG-NOTE-UI-001: reopening the same note preserves its unsaved draft',async()=>fixture(async node=>{await edit(node);await button(node,'Fechar editor da nota');await button(node,'Editar');assert.equal(node.querySelector('textarea').value,'Rascunho não salvo');}));
test('REG-NOTE-UI-002: another note history cannot replace the active draft history',async()=>fixture(async(node,calls)=>{await edit(node);await button(node,'Histórico',1);assert.equal(calls(),0);assert.equal(node.querySelector('textarea').value,'Rascunho não salvo');assert.match(node.textContent,/Salve ou descarte/);}));

test('card editor preserves evidence and note link while submitting authored quiz metadata',async()=>{
 const node=document.getElementById('root'),root=createRoot(node),originalForm=globalThis.FormData;globalThis.FormData=dom.window.FormData;
 const details={origin:'Nota científica',materialId:'a',evidence:'Água ferve a 100 °C a 1 atm.',evidenceStatus:'matched_text',hint:'Considere a pressão.',tags:['Física'],alternatives:['0 °C','50 °C']};let saved;
 try{await act(()=>root.render(createElement(CardEditor,{card:{id:'card',front:'Temperatura?',back:'100 °C',details},id:'new',busy:false,pending:false,onSave:async value=>{saved=value;}})));await act(()=>node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(saved.id,'card');assert.deepEqual(saved.details,details);assert.equal(saved.front,'Temperatura?');assert.equal(saved.back,'100 °C');}finally{await act(()=>root.unmount());globalThis.FormData=originalForm;}
});


test('REG-DRAFT-RELOAD-001: main note draft can be recovered after remount with its original concurrency baseline',async()=>{
 localStorage.clear();const node=document.getElementById('root');let root=createRoot(node),saved;
 const props={deckId:'d',draftScope:'qa-drafts',source:'Original',busy:false,onGenerate:()=>{},onSave:async(source,expectedSource)=>{saved={source,expectedSource};return true;}};
 try{await act(()=>root.render(createElement(DeckMaterials,props)));const textarea=node.querySelector('textarea');await act(()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(textarea,'Rascunho persistente');textarea.dispatchEvent(new Event('input',{bubbles:true}));});await act(()=>root.unmount());root=createRoot(node);await act(()=>root.render(createElement(DeckMaterials,{...props,source:'Mudou em outro dispositivo'})));assert.match(node.textContent,/Recuperar rascunho/);await button(node,'Recuperar rascunho');assert.equal(node.querySelector('textarea').value,'Rascunho persistente');await act(async()=>{node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});assert.deepEqual(saved,{source:'Rascunho persistente',expectedSource:'Original'});}finally{await act(()=>root.unmount());localStorage.clear();}
});

test('REG-DRAFT-RELOAD-002: additional note recovers content and revision without overwriting another note',async()=>{
 localStorage.clear();globalThis.fetch=async()=>Response.json({notes,files:[]});
 const node=document.getElementById('root');let root=createRoot(node);
 const props={deckId:'deck',draftScope:'qa-notes',busy:false};
 try{await act(async()=>root.render(createElement(Library,props)));await edit(node);await act(()=>root.unmount());root=createRoot(node);await act(async()=>root.render(createElement(Library,props)));await button(node,'Recuperar rascunho');assert.equal(node.querySelector('textarea').value,'Rascunho não salvo');assert.equal(node.querySelector('input').value,'Nota A');await button(node,'Editar',1);assert.equal(node.querySelector('textarea').value,'Rascunho não salvo');assert.match(node.textContent,/Salve ou descarte/);}finally{await act(()=>root.unmount());localStorage.clear();}
});

test('REG-DRAFT-RELOAD-003: generation recovers edited source and requested card count',async()=>{
 localStorage.clear();const node=document.getElementById('root');let root=createRoot(node);
 const props={deckId:'deck',draftScope:'qa-generate',source:'Original',aiReady:true,busy:false,pending:false,onBusyChange:()=>{},onSave:async()=>true};
 try{await act(()=>root.render(createElement(GenerateCards,props)));await act(()=>{const textarea=node.querySelector('textarea');Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(textarea,'Conteúdo editado para gerar cartões depois.');textarea.dispatchEvent(new Event('input',{bubbles:true}));const count=node.querySelector('input[type=number]');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(count,'300');count.dispatchEvent(new Event('input',{bubbles:true}));});await act(()=>root.unmount());root=createRoot(node);await act(()=>root.render(createElement(GenerateCards,props)));await button(node,'Recuperar rascunho');assert.equal(node.querySelector('textarea').value,'Conteúdo editado para gerar cartões depois.');assert.equal(node.querySelector('input[type=number]').value,'300');}finally{await act(()=>root.unmount());localStorage.clear();}
});

test('REG-DRAFT-CORRUPT-001: editing cannot silently replace an unreadable saved draft',async()=>{
 localStorage.clear();const key=draftKey('qa-corrupt','deck','main-note');localStorage.setItem(key,'{unreadable');
 const node=document.getElementById('root'),root=createRoot(node);
 try{await act(()=>root.render(createElement(DeckMaterials,{deckId:'deck',draftScope:'qa-corrupt',source:'Original',busy:false,onSave:async()=>false,onGenerate:()=>{}})));assert.match(node.textContent,/não pôde ser lido/);await act(()=>{const input=node.querySelector('textarea');Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(input,'Novo texto');input.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(localStorage.getItem(key),'{unreadable');}finally{await act(()=>root.unmount());localStorage.clear();}
});

test('generation preview survives reload and failed save; only confirmed save removes the draft',async()=>{
 localStorage.clear();globalThis.fetch=async()=>Response.json({cards:[1,2,3].map(n=>({id:'generated-'+n,front:'Pergunta '+n,back:'Resposta '+n,evidence:'Trecho '+n,evidenceStatus:'matched_text'}))});
 const node=document.getElementById('root');let root=createRoot(node),confirmed=false,saved;
 const props={deckId:'deck',draftScope:'qa-preview',source:'Conteúdo sintético suficiente para gerar três cartões.',aiReady:true,busy:false,pending:false,onBusyChange:()=>{},onSave:async(cards,source)=>{saved={cards,source};return confirmed;}};
 async function mount(){root=createRoot(node);await act(()=>root.render(createElement(GenerateCards,props)));}
 try{await act(()=>root.render(createElement(GenerateCards,props)));await act(()=>{const input=node.querySelector('input[type=number]');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'3');input.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>{node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});assert.equal(node.querySelectorAll('fieldset').length,3);await act(()=>root.unmount());await mount();await button(node,'Recuperar rascunho');assert.equal(node.querySelectorAll('fieldset').length,3);await button(node,'Salvar 3 cartões');assert.equal(saved.cards[0].details.evidence,'Trecho 1');assert.equal(saved.cards[0].details.sourceType,'text');assert.ok(localStorage.getItem(draftKey('qa-preview','deck','generation:main')));confirmed=true;await button(node,'Salvar 3 cartões');assert.equal(localStorage.getItem(draftKey('qa-preview','deck','generation:main')),null);}finally{await act(()=>root.unmount());localStorage.clear();}
});

test('REG-DRAFT-COUNT-001: temporarily invalid count does not destroy the last recoverable generation draft',async()=>{
 localStorage.clear();const node=document.getElementById('root');let root=createRoot(node);
 const props={deckId:'deck',draftScope:'qa-count',source:'Original',aiReady:true,busy:false,pending:false,onBusyChange:()=>{},onSave:async()=>false};
 try{await act(()=>root.render(createElement(GenerateCards,props)));await act(()=>{const input=node.querySelector('textarea');Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(input,'Texto que precisa continuar recuperável.');input.dispatchEvent(new Event('input',{bubbles:true}));});await act(()=>{const input=node.querySelector('input[type=number]');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}));});await act(()=>root.unmount());root=createRoot(node);await act(()=>root.render(createElement(GenerateCards,props)));await button(node,'Recuperar rascunho');assert.equal(node.querySelector('textarea').value,'Texto que precisa continuar recuperável.');assert.equal(node.querySelector('input[type=number]').value,'20');}finally{await act(()=>root.unmount());localStorage.clear();}
});

test('release editor exposes only completed card type',async()=>{
 const node=document.getElementById('root'),root=createRoot(node);
 try{await act(()=>root.render(createElement(CardEditor,{id:'new-release',busy:false,pending:false,onSave:async()=>false})));assert.deepEqual([...node.querySelectorAll('select[aria-label="Tipo de cartão"] option')].map(option=>option.value),['qa','cloze','true_false']);}finally{await act(()=>root.unmount());}
});

test('REG-GENERATE-SHORT-002: short pasted source finishes with drafts and no false error or paid retry button',async()=>{
 localStorage.clear();let calls=0;globalThis.fetch=async()=>Response.json({cards:++calls===1?[{id:'short',front:'Pergunta sintética',back:'Resposta sintética'}]:[]});
 const node=document.getElementById('root'),root=createRoot(node);
 try{await act(()=>root.render(createElement(GenerateCards,{deckId:'deck',source:'Texto sintético curto com apenas um fato disponível.',aiReady:true,busy:false,pending:false,onBusyChange:()=>{},onSave:async()=>false})));await act(async()=>{node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});assert.equal(node.querySelector('[role=alert]'),null);assert.match(node.textContent,/material.*1 cartão/i);assert.equal(node.querySelectorAll('fieldset').length,1);assert.ok(![...node.querySelectorAll('button')].some(button=>button.textContent==='Continuar geração'));await button(node,'Remover cartão 1');assert.ok([...node.querySelectorAll('button')].some(button=>button.textContent==='Gerar rascunhos'));}finally{await act(()=>root.unmount());localStorage.clear();}
});

test('REG-PDF100-001: library sends an exact 100 MB PDF as fifty chunks and completes once',async()=>{
 const requests=[],progress=[];
 globalThis.fetch=async(url,options)=>{requests.push({url:String(url),options});return Response.json({ok:true});};
 const file={name:'synthetic-100mb.pdf',type:'application/pdf',size:100_000_000,slice:(start,end)=>new Blob([new Uint8Array(Math.min(end,100_000_000)-start)])};
 await uploadMaterialFile('qa-100mb',file,value=>progress.push(value));
 const puts=requests.filter(r=>r.options.method==='PUT');
 assert.equal(puts.length,50);assert.ok(puts[49].url.endsWith('&part=49'));
 assert.ok(puts.every(r=>r.options.body.size===2_000_000));
 const posts=requests.filter(r=>r.options.method==='POST').map(r=>JSON.parse(r.options.body));
 assert.deepEqual(posts.map(p=>p.action),['start','complete']);assert.equal(posts[0].bytes,100_000_000);
 assert.equal(progress.at(-1),100);
});

test('REG-PDF100-002: files above 100 MB are rejected before any request',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({});};
 await assert.rejects(uploadMaterialFile('qa-100mb',{name:'oversize.pdf',type:'application/pdf',size:100_000_001},()=>{}),/100 MB/);
 assert.equal(calls,0);
});

test('REG-PDF100-GENERATE-001: real 100 MB file is locally reduced to bounded PDFs and generates a saveable preview',async()=>{
 const {PDFDocument}=await import('../lib/vendor/pdf-lib.mjs');
 const doc=await PDFDocument.create();doc.addPage([200,200]).drawText('Fonte sintetica',{x:10,y:100});const bytes=await doc.save();
 const file=new File([new Uint8Array(bytes),new Uint8Array(100_000_000-bytes.length).fill(32)],'original-100mb.pdf',{type:'application/pdf'});
 let uploadedBytes=0,cleaned=0,saved;
 globalThis.fetch=async(url,options)=>{
  if(options.method==='PUT')return Response.json({ticket:'part'});
  const body=JSON.parse(options.body);
  if(String(url).endsWith('/uploads')){
   if(body.action==='start'){assert.ok(body.bytes<=45_000_000);uploadedBytes+=body.bytes;}
   if(body.action==='cancel')cleaned++;
   return Response.json({ticket:'synthetic-file-ticket'});
  }
  assert.equal(body.fileTicket,'synthetic-file-ticket');
  return Response.json({cards:Array.from({length:body.count},(_,i)=>({id:'pdf-card-'+i,front:'Pergunta PDF '+i,back:'Resposta '+i,evidence:'Trecho sintético',evidenceStatus:'unverified_attachment'}))});
 };
 const node=document.getElementById('root'),root=createRoot(node);
 try{
  await act(()=>root.render(createElement(GenerateCards,{deckId:'qa-pdf100',source:'',aiReady:true,busy:false,pending:false,onBusyChange:()=>{},onSave:async cards=>{saved=cards;return true;}})));
  await act(()=>{const count=node.querySelector('input[type=number]');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(count,'3');count.dispatchEvent(new Event('input',{bubbles:true}));const input=node.querySelector('input[type=file]');Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>{node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  for(let i=0;i<300&&!node.querySelectorAll('fieldset').length&&!node.querySelector('[role=alert]');i++)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
  assert.equal(node.querySelector('[role=alert]'),null,node.textContent);assert.equal(node.querySelectorAll('fieldset').length,3);assert.ok(uploadedBytes>0&&uploadedBytes<50_000_000);
  for(let i=0;i<100&&!cleaned;i++)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
  assert.equal(cleaned,1);await button(node,'Salvar 3 cartões');assert.equal(saved[0].details.origin,'original-100mb.pdf');assert.equal(saved[0].details.sourceType,'pdf');
 }finally{await act(()=>root.unmount());}
});

test('true/false editor authors false and reopens it without losing metadata',async()=>{
 const node=document.getElementById('root'),root=createRoot(node);let saved;
 try{
  await act(()=>root.render(createElement(CardEditor,{card:{id:'tf-editor',revision:2,front:'Afirmação sintética',back:'Resposta antiga',details:{origin:'Fonte sintética'}},id:'new',busy:false,pending:false,onSave:async card=>{saved=card;return true;}})));
  await act(()=>{const select=node.querySelector('[aria-label="Tipo de cartão"]');select.value='true_false';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(()=>{const select=node.querySelector('[aria-label="Resposta correta"]');select.value='false';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(saved.back,'Falso');assert.equal(saved.details.template.correct,false);assert.equal(saved.details.origin,'Fonte sintética');assert.equal(saved.revision,2);
  await act(()=>root.render(createElement(CardEditor,{key:'reopened',card:saved,id:'new',busy:false,pending:false,onSave:async()=>true})));
  assert.equal(node.querySelector('[aria-label="Resposta correta"]').value,'false');
 }finally{await act(()=>root.unmount());}
});

for(const correct of [true,false])for(const chosen of [true,false])test(`true/false exercise evaluates key=${correct}, choice=${chosen} and waits for confirmation`,async()=>{
 const {default:TemplateQuiz}=await import('../.test-artifacts/app/template-quiz.mjs');
 const node=document.getElementById('root'),root=createRoot(node),results=[];let revealed=false;
 const render=()=>root.render(createElement(TemplateQuiz,{template:{type:'true_false',correct},revealed,busy:false,onComplete:value=>{results.push(value);revealed=true;render();}}));
 try{
  await act(render);assert.equal(node.querySelector('button').disabled,true);
  await act(()=>node.querySelectorAll('input[type=radio]')[chosen?0:1].click());assert.equal(results.length,0);
  await button(node,'Conferir exercício');assert.deepEqual(results,[correct===chosen]);
  assert.ok([...node.querySelectorAll('input')].every(input=>input.matches(':disabled')));
  assert.match(node.querySelector('[role=status]').textContent,correct?/Verdadeiro/:/Falso/);
 }finally{await act(()=>root.unmount());}
});

for(const correctChoice of [true,false])test(`REG-TF-STUDY-001: mixed quiz preserves alignment and saves ${correctChoice?'good':'again'} only on advance`,async()=>{
 const {default:Lume}=await import('../.test-artifacts/app/lume.mjs');
 const previousClearInterval=globalThis.clearInterval;globalThis.clearInterval=dom.window.clearInterval.bind(dom.window);
 const previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
 const node=document.getElementById('root'),root=createRoot(node),requests=[];
 const state={name:'Prévia local',draftScope:'qa-tf-study',decks:[{id:'tf-deck',title:'Baralho sintético',description:'',color:'green',source:''}],cards:[{id:'tf',deck_id:'tf-deck',front:'Afirmação sintética falsa',back:'Falso',revision:0,due:0,interval:0,details:{template:{type:'true_false',correct:false}}},{id:'qa',deck_id:'tf-deck',front:'Pergunta comum',back:'Resposta comum',revision:0,due:0,interval:0,details:{alternatives:['Alternativa sintética']}}],reviews:[],messages:[],aiReady:false};
 let failOnce=!correctChoice;
 globalThis.fetch=async(url,options={})=>{
  if(String(url).includes('/materials'))return Response.json({notes:[],files:[]});
  if(options.method==='POST'){
   const body=JSON.parse(options.body);requests.push(body);assert.equal(body.action,'review');
   if(failOnce){failOnce=false;return Response.json({error:'Falha sintética de gravação'},{status:500});}
   return Response.json(state);
  }
  return Response.json(state);
 };
 try{
  await act(async()=>root.render(createElement(Lume)));
  const deckButton=[...node.querySelectorAll('button')].find(b=>b.textContent.includes('Baralho sintético'));assert.ok(deckButton);await act(()=>deckButton.click());
  await button(node,'Quiz de alternativas');assert.equal(node.querySelectorAll('input[type=radio]').length,2);
  await act(()=>node.querySelectorAll('input[type=radio]')[correctChoice?1:0].click());await button(node,'Conferir exercício');assert.equal(requests.length,0);
  await button(node,'Próximo cartão');
  if(!correctChoice){assert.equal(node.querySelector('.study .pill').textContent,'1 / 2');assert.match(node.textContent,/Falha sintética/);await button(node,'Próximo cartão');}
  assert.equal(requests.at(-1).cardId,'tf');assert.equal(requests.at(-1).rating,correctChoice?'good':'again');
  assert.equal(node.querySelector('.study .pill').textContent,'2 / 2');assert.equal(node.querySelectorAll('input[type=radio]').length,0);
  assert.match(node.querySelector('.flashcard h2').textContent,/Pergunta comum/);
 }finally{await act(()=>root.unmount());globalThis.clearInterval=previousClearInterval;if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);else delete globalThis.navigator;}
});

test('true/false editor recovers the chosen key and keeps its draft after a failed save',async()=>{
 localStorage.clear();const node=document.getElementById('root');let root=createRoot(node),saved;
 const props={card:{id:'tf-draft',front:'Afirmação sintética',back:'Falso',details:{template:{type:'true_false',correct:false}}},id:'new',deckId:'deck',draftScope:'qa-tf-draft',busy:false,pending:false,onSave:async value=>{saved=value;return false;}};
 try{
  await act(()=>root.render(createElement(CardEditor,props)));
  await act(()=>{const select=node.querySelector('[aria-label="Resposta correta"]');select.value='true';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(()=>root.unmount());root=createRoot(node);await act(()=>root.render(createElement(CardEditor,props)));
  await button(node,'Recuperar rascunho');assert.equal(node.querySelector('[aria-label="Resposta correta"]').value,'true');
  await act(async()=>node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(saved.back,'Verdadeiro');assert.ok(localStorage.getItem(draftKey('qa-tf-draft','deck','card:tf-draft')));
 }finally{await act(()=>root.unmount());localStorage.clear();}
});

test('cloze editor preserves source and markup when saving and reopening',async()=>{
 const node=document.getElementById('root'),root=createRoot(node);let saved;
 const card={id:'cloze-edit',front:'Complete as cargas',back:'Carga -1 e íon Na⁺.',revision:4,details:{origin:'Fonte sintética',template:{type:'cloze',text:'Carga {{-1}} e íon {{Na⁺}}.'}}};
 try{await act(()=>root.render(createElement(CardEditor,{card,id:'new',busy:false,pending:false,onSave:async value=>{saved=value;return true;}})));
 assert.equal(node.querySelector('[aria-label="Conteúdo do exercício"]').value,card.details.template.text);
 await act(async()=>node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(saved.back,card.back);assert.deepEqual(saved.details.template,card.details.template);assert.equal(saved.details.origin,card.details.origin);assert.equal(saved.revision,4);
 await act(()=>root.render(createElement(CardEditor,{key:'reopen-cloze',card:saved,id:'new',busy:false,pending:false,onSave:async()=>true})));assert.equal(node.querySelector('[aria-label="Conteúdo do exercício"]').value,card.details.template.text);
 }finally{await act(()=>root.unmount());}
});

test('cloze editor blocks malformed markup and recovers unsaved changes after a failed save',async()=>{
 localStorage.clear();const node=document.getElementById('root');let root=createRoot(node),calls=0;
 const card={id:'cloze-draft',front:'Complete',back:'Carga -1.',details:{template:{type:'cloze',text:'Carga {{-1}}.'}}};
 const props={card,id:'new',deckId:'deck',draftScope:'qa-cloze',busy:false,pending:false,onSave:async()=>{calls++;return false;}};
 const fill=async text=>act(()=>{const input=node.querySelector('[aria-label="Conteúdo do exercício"]');Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}));});
 try{await act(()=>root.render(createElement(CardEditor,props)));await fill('Carga {{{-1}}}.');await act(async()=>node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(calls,0);assert.match(node.querySelector('[role=alert]').textContent,/lacunas/);
 await fill('Carga {{-2}}.');await act(async()=>node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(calls,1);
 await act(()=>root.unmount());root=createRoot(node);await act(()=>root.render(createElement(CardEditor,props)));await button(node,'Recuperar rascunho');assert.equal(node.querySelector('[aria-label="Conteúdo do exercício"]').value,'Carga {{-2}}.');
 }finally{await act(()=>root.unmount());localStorage.clear();}
});

for(const correctChoice of [true,false])test('cloze exercise requires all blanks and reveals the key only after confirmation: '+correctChoice,async()=>{
 const {default:TemplateQuiz}=await import('../.test-artifacts/app/template-quiz.mjs');const node=document.getElementById('root'),root=createRoot(node);let revealed=false;const results=[];
 const render=()=>root.render(createElement(TemplateQuiz,{template:{type:'cloze',text:'Carga {{-1}} e íon {{Na⁺}}.'},revealed,busy:false,onComplete:value=>{results.push(value);revealed=true;render();}}));
 const fill=async(index,text)=>act(()=>{const input=node.querySelectorAll('input')[index];Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}));});
 try{await act(render);assert.equal(node.querySelector('button').disabled,true);assert.ok(!node.textContent.includes('Na⁺'));assert.ok(!node.textContent.includes('-1'));
 await fill(0,correctChoice?'-1':'1');assert.equal(node.querySelector('button').disabled,true);await fill(1,'Na⁺');assert.deepEqual(results,[]);await button(node,'Conferir exercício');assert.deepEqual(results,[correctChoice]);assert.ok([...node.querySelectorAll('input')].every(input=>input.disabled));assert.match(node.querySelector('[role=status]').textContent,/Carga -1 e íon Na⁺/);
 }finally{await act(()=>root.unmount());}
});

for(const correctChoice of [true,false])test('REG-CLOZE-STUDY-001: quiz records only on advance and clears the next blanks: '+correctChoice,async()=>{
 const {default:Lume}=await import('../.test-artifacts/app/lume.mjs');const previousClearInterval=globalThis.clearInterval;globalThis.clearInterval=dom.window.clearInterval.bind(dom.window);const previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
 const node=document.getElementById('root'),root=createRoot(node),requests=[];
 const state={name:'Prévia local',draftScope:'cloze-study',decks:[{id:'cloze-deck',title:'Lacunas sintéticas',description:'',color:'green',source:''}],cards:[{id:'c1',deck_id:'cloze-deck',front:'Complete a carga',back:'Carga -1.',revision:0,due:0,interval:0,details:{template:{type:'cloze',text:'Carga {{-1}}.'}}},{id:'c2',deck_id:'cloze-deck',front:'Complete o íon',back:'Íon Na⁺.',revision:0,due:0,interval:0,details:{template:{type:'cloze',text:'Íon {{Na⁺}}.'}}}],reviews:[],messages:[],aiReady:false};let failOnce=!correctChoice;
 globalThis.fetch=async(url,options={})=>{if(String(url).includes('/materials'))return Response.json({notes:[],files:[]});if(options.method==='POST'){requests.push(JSON.parse(options.body));if(failOnce){failOnce=false;return Response.json({error:'Falha sintética'},{status:500});}}return Response.json(state);};
 try{await act(async()=>root.render(createElement(Lume)));await act(()=>[...node.querySelectorAll('button')].find(b=>b.textContent.includes('Lacunas sintéticas')).click());await button(node,'Quiz de alternativas');
 const input=node.querySelector('[aria-label="Lacuna 1"]');assert.ok(input);await act(()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,correctChoice?'-1':'1');input.dispatchEvent(new Event('input',{bubbles:true}));});await button(node,'Conferir exercício');assert.equal(requests.length,0);await button(node,'Próximo cartão');
 if(!correctChoice){assert.equal(node.querySelector('.study .pill').textContent,'1 / 2');await button(node,'Próximo cartão');}
 assert.equal(requests.at(-1).cardId,'c1');assert.equal(requests.at(-1).rating,correctChoice?'good':'again');assert.equal(node.querySelector('.study .pill').textContent,'2 / 2');assert.equal(node.querySelector('[aria-label="Lacuna 1"]').value,'');assert.ok(!node.querySelector('.template-quiz').textContent.includes('Na⁺'));
 }finally{await act(()=>root.unmount());globalThis.clearInterval=previousClearInterval;if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);else delete globalThis.navigator;}
});
