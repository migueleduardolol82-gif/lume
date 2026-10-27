// Contract fixture only: never connects to a database or runs model inference.
export const fixture={card:null,writes:[]};
export function reset(card=null){fixture.card=card;fixture.writes=[];}
export class AppError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export async function getOwner(){return {userId:'synthetic-owner',displayName:'Prévia local'};}
export async function ai(){throw Error('IA proibida neste teste.');}
export function readTicket(){throw Error('Upload proibido neste teste.');}
export const db={
 prepare(sql){return {values:[],bind(...values){this.values=values;return this;},
  async first(){if(sql.startsWith('SELECT * FROM decks'))return {title:'Baralho sintético',source:''};if(sql.startsWith('SELECT * FROM cards'))return fixture.card;if(sql.startsWith('SELECT id FROM decks'))return {id:'deck'};throw Error('Consulta não prevista na fixture.');},
  async all(){if(sql.startsWith('SELECT'))return {results:[]};throw Error('Leitura não prevista na fixture.');},
  async run(){fixture.writes.push({sql,values:this.values});return {meta:{changes:1}};}
 };},
 async transaction(callback){return callback(this);},
 async batch(statements){return Promise.all(statements.map(statement=>statement.run()));}
};
