import assert from 'node:assert/strict';
const {db}=await import('../lib/database.ts');
const id=crypto.randomUUID(),cardId=crypto.randomUUID();
try{
 await assert.rejects(()=>db.batch([
  db.prepare('INSERT INTO decks(id,owner,title,description,color,source,created) VALUES (?,?,?,\'\',\'blue\',\'\',0)').bind(id,'transaction-test','Temporary rollback test'),
  db.prepare('INSERT INTO cards(id,owner,deck_id,front,back,due) VALUES (?,?,?,?,?,0)').bind(cardId,'transaction-test','missing-deck','Question','Answer')
 ]),e=>e.code==='23503');
 assert.equal(await db.prepare('SELECT id FROM decks WHERE id=?').bind(id).first(),null);
 console.log('PASS: falha no segundo comando reverte o lote inteiro.');
}finally{await db.prepare('DELETE FROM decks WHERE id=? AND owner=?').bind(id,'transaction-test').run();}
