import 'server-only';
export type User={userId:string;displayName:string};
// Production identity is enforced by Vercel Authentication on ALL deployments.
// This is an owner-only app: all admitted requests share a stable personal space.
// Never read or trust ChatGPT identity headers outside Sites.
export async function getOwner():Promise<User|null>{
 if(process.env.VERCEL==='1'&&process.env.LUME_OWNER_ID)return {userId:process.env.LUME_OWNER_ID,displayName:process.env.LUME_OWNER_NAME||'Meu espaço'};
 if(process.env.NODE_ENV==='development'&&process.env.LUME_LOCAL_TEST==='1')return {userId:'local-test',displayName:'Prévia local'};
 return null;
}
