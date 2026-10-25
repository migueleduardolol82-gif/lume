import assert from 'node:assert/strict';
import {loadEnvFile} from 'node:process';
import {Pool} from 'pg';

// Run against the local development server. Credentials stay in memory and are never logged.
loadEnvFile(new URL('../.env.local',import.meta.url));
assert.ok(process.env.DATABASE_URL,'Configure o banco de desenvolvimento antes deste teste.');
const connection=new URL(process.env.DATABASE_URL);
connection.searchParams.set('sslmode','verify-full');
const pool=new Pool({connectionString:connection.toString(),max:1,connectionTimeoutMillis:15000});
const url='http://127.0.0.1:5173/api/lume';
const owner='local-test',run=crypto.randomUUID(),otherOwner='messages-window-'+run;
const deckIds=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
let cleanupNeeded=false;
async function state(){
 const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
 assert.equal(response.status,200,'A API local deve estar disponível.');
 const data=await response.json();
 assert.equal(data.name,'Prévia local','Este teste exige a identidade local de desenvolvimento.');
 return data;
}
async function insertMessages(rows){
 await pool.query('INSERT INTO messages(id,owner,deck_id,role,content,created) SELECT x.id,x.owner,x.deck_id,x.role,x.content,x.created FROM jsonb_to_recordset($1::jsonb) AS x(id text,owner text,deck_id text,role text,content text,created bigint)',[JSON.stringify(rows)]);
}
function checkWindow(data,expected){
 assert.equal(data.messages.length,1000,'O limite deve ser global, não por baralho.');
 assert.ok(data.messages.every(message=>message.owner===owner),'A janela não deve incluir mensagens de outra conta.');
 assert.ok(data.messages.every((message,index)=>message.id===expected[index].id),'A janela deve conter as mensagens mais recentes em ordem cronológica, com desempate por id.');
}
try{
 await state();
 // All fixture messages are newer than existing local messages; existing data is untouched.
 const latest=await pool.query('SELECT COALESCE(MAX(created),0)::text AS created FROM messages WHERE owner=$1',[owner]);
 const base=Math.max(Date.now(),Number(latest.rows[0].created))+1000;
 const decks=deckIds.map((id,index)=>({id,owner:index===2?otherOwner:owner,title:'Teste temporário de histórico '+run,created:base}));
 cleanupNeeded=true;
 await pool.query("INSERT INTO decks(id,owner,title,description,color,source,created) SELECT x.id,x.owner,x.title,'','violet','',x.created FROM jsonb_to_recordset($1::jsonb) AS x(id text,owner text,title text,created bigint)",[JSON.stringify(decks)]);
 const rows=Array.from({length:1003},(_,index)=>({id:run+'-'+String(index).padStart(4,'0'),owner,deck_id:deckIds[index%2],role:index%2?'assistant':'user',content:'Mensagem sintética '+index,created:base+Math.floor(index/2)}));
 await insertMessages([...rows,{id:crypto.randomUUID(),owner:otherOwner,deck_id:deckIds[2],role:'assistant',content:'Mensagem de outra conta',created:base+10000}]);
 checkWindow(await state(),rows.slice(-1000));
 // A newly saved question and answer must remain visible after crossing the history limit.
 const recent=[{id:run+'-1003',owner,deck_id:deckIds[0],role:'user',content:'Pergunta recente',created:base+503},{id:run+'-1004',owner,deck_id:deckIds[0],role:'assistant',content:'Resposta recente',created:base+503}];
 await insertMessages(recent);
 const updated=await state();
 checkWindow(updated,[...rows,...recent].slice(-1000));
 assert.equal(updated.messages.at(-2).content,'Pergunta recente');
 assert.equal(updated.messages.at(-1).content,'Resposta recente');
 console.log('PASS: últimas 1.000 mensagens globais, par recente visível, ordem cronológica, empates por id e isolamento entre contas. Nenhuma chamada de IA.');
}catch(error){
 console.error('FAIL: messages-window:',error instanceof assert.AssertionError?error.message:error?.code||error?.name||'erro desconhecido');
 process.exitCode=1;
}finally{
 if(cleanupNeeded)try{
  // Exact IDs and owners only; deleting these fixture decks cascades to their messages.
  await pool.query('DELETE FROM decks WHERE (owner=$1 AND id=ANY($2::text[])) OR (owner=$3 AND id=$4)',[owner,deckIds.slice(0,2),otherOwner,deckIds[2]]);
  const remaining=await pool.query('SELECT COUNT(*)::int AS count FROM messages WHERE deck_id=ANY($1::text[])',[deckIds]);
  assert.equal(remaining.rows[0].count,0,'A limpeza deve remover todas as mensagens sintéticas.');
  console.log('PASS: limpeza restrita aos três baralhos temporários.');
 }catch(error){console.error('FAIL: messages-window cleanup:',error?.code||error?.name||'erro desconhecido');process.exitCode=1;}
 await pool.end();
}
