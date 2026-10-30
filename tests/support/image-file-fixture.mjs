export const fixture={owner:'synthetic-owner',file:null,bytes:Buffer.from([137,80,78,71,13,10,26,10]),reads:0};
export class AppError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export async function getOwner(){return fixture.owner?{userId:fixture.owner}:null;}
export const db={prepare(sql){return {bind(...values){this.values=values;return this;},async first(){
 fixture.reads++;
 const file=fixture.file;
 if(sql.startsWith('SELECT * FROM material_files'))return file&&file.id===this.values[0]&&file.owner===this.values[1]&&file.status==='ready'?file:null;
 if(sql.startsWith('SELECT c.data'))return file&&file.id===this.values[0]&&file.owner===this.values[1]?{data:fixture.bytes}:null;
 throw Error('Consulta não prevista.');
}};}};
