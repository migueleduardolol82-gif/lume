import assert from 'node:assert/strict';
const url='http://127.0.0.1:5173/api/lume',title='Importação legada '+crypto.randomUUID();
const headers={'Content-Type':'application/json'};
async function post(body){const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
let id;
try{const cards=Array.from({length:301},(_,i)=>({front:'Pergunta '+i,back:'Resposta '+i}));const r=await post({action:'importBackup',decks:[{title,description:'Teste temporário',color:'blue',cards}]});assert.equal(r.status,200,r.data.error);id=r.data.decks.find(d=>d.title===title)?.id;assert.ok(id);assert.equal(r.data.cards.filter(c=>c.deck_id===id).length,301);const excessive=await post({action:'importBackup',decks:[{title:title+' A',cards:cards.concat(cards.slice(0,199))},{title:title+' B',cards:cards.concat(cards.slice(0,199))}]});assert.equal(excessive.status,400);const state=await (await fetch(url)).json();assert.equal(state.decks.filter(d=>d.title.startsWith(title)).length,1);console.log('PASS: backup de conteúdo com 301 cartões e limite global de 900 sem importação parcial.');}finally{if(id)await post({action:'deleteDeck',deckId:id});}
