import 'server-only';
import {Pool,types,type QueryResultRow} from 'pg';
import {attachDatabasePool} from '@vercel/functions';
// All bigint values in this schema are millisecond timestamps (< 2^53).
types.setTypeParser(20,value=>Number(value));
let pool:Pool|undefined;
function getPool(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada.');if(!pool){pool=new Pool({connectionString:(()=>{const url=new URL(process.env.DATABASE_URL!);url.searchParams.set('sslmode','verify-full');return url.toString();})(),max:5,idleTimeoutMillis:10000,connectionTimeoutMillis:15000});attachDatabasePool(pool);}return pool;}
type Executor={query:(text:string,values?:unknown[])=>Promise<{rows:QueryResultRow[];rowCount:number|null}>};
export class Statement{
 constructor(readonly sql:string,readonly values:unknown[]=[],private executor?:Executor){}
 bind(...values:unknown[]){return new Statement(this.sql,values,this.executor);}
 async execute(){let n=0;let text=this.sql.replace(/\?/g,()=>'$'+(++n));if(text.startsWith('INSERT OR IGNORE'))text=text.replace('INSERT OR IGNORE','INSERT')+' ON CONFLICT DO NOTHING';return (this.executor||getPool()).query(text,this.values);}
 async all<T=Record<string,unknown>>(){return {results:(await this.execute()).rows as T[]};}
 async first<T=Record<string,unknown>>(){return ((await this.execute()).rows[0] as T|undefined)??null;}
 async run(){return {meta:{changes:(await this.execute()).rowCount||0}};}
}
export class Database{
 constructor(private executor?:Executor){}
 prepare(sql:string){return new Statement(sql,[],this.executor);}
 async batch(statements:Statement[]){return this.transaction(async db=>{const results=[];for(const statement of statements)results.push(await db.prepare(statement.sql).bind(...statement.values).run());return results;});}
 async transaction<T>(fn:(db:Database)=>Promise<T>):Promise<T>{if(this.executor)return fn(this);const client=await getPool().connect();try{await client.query('BEGIN');const result=await fn(new Database(client));await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
}
export const db=new Database();
