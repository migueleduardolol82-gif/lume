export const fixture={owner:'synthetic-owner',file:null,card:null,writes:[],bytes:Buffer.from([137,80,78,71,13,10,26,10]),reads:0};
export class AppError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export async function getOwner(){return fixture.owner?{userId:fixture.owner}:null;}
export const db={async transaction(callback){return callback(this);},prepare(sql){return {bind(...values){this.values=values;return this;},async run(){fixture.writes.push(sql);if(sql.startsWith('DELETE FROM material_files'))fixture.file=null;return {meta:{changes:1}};},async first(){
 fixture.reads++;
 const file=fixture.file;
 if(sql.startsWith('SELECT id FROM decks'))return {id:'deck'};
 if(sql.startsWith('SELECT id FROM cards')){const card=fixture.card;return card&&card.owner===this.values[0]&&card.details?.template?.type==='image'&&card.details.template.fileId===this.values[1]?{id:card.id}:null;}
 if(sql.startsWith('SELECT * FROM material_files'))return file&&file.id===this.values[0]&&file.owner===this.values[1]&&(sql.includes("status='ready'")?file.status==='ready':file.deck_id===this.values[2])?file:null;
 if(sql.startsWith('SELECT c.data'))return file&&file.id===this.values[0]&&file.owner===this.values[1]?{data:fixture.bytes}:null;
 throw Error('Consulta não prevista.');
}};}};
