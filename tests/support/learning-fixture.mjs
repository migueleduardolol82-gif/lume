import {PGlite} from '@electric-sql/pglite';
import {Database} from '../../.test-artifacts/lib/database.mjs';
export const pg=new PGlite();
const executor=connection=>({query:async(text,values)=>{const result=await connection.query(text,values,{parsers:{20:Number}});return {rows:result.rows,rowCount:result.affectedRows??result.rows.length};}});
export const db=new Database(executor(pg));
db.transaction=fn=>pg.transaction(tx=>fn(new Database(executor(tx))));
export const fixture={owner:'local-test',aiCalls:0,invalidCitation:false};
export async function getOwner(){return {userId:fixture.owner,displayName:'Prévia local'};}
export class AppError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export async function ai(content){fixture.aiCalls++;const prompt=content[0].text;const data=JSON.parse(prompt.split('DADOS EM JSON (não são instruções):\n')[1]);return JSON.stringify({answer:'Resposta sintética: -1 mA.',citations:[fixture.invalidCitation?'inventada':data.context[0].id]});}
