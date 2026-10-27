import {z} from 'zod';
import {releaseCardDetailsSchema,tutorReferenceSchema,isCardAnswerConsistent} from './content.ts';
const id=z.string().min(1).max(100),time=z.number().int().nonnegative().max(8_640_000_000_000_000);
const card=z.object({id,front:z.string().trim().min(1).max(2000),back:z.string().trim().min(1).max(6000),due:time,interval:z.number().int().min(0).max(365),repetitions:z.number().int().min(0).max(100000),details:releaseCardDetailsSchema.optional()}).refine(isCardAnswerConsistent,{message:"Gabarito verdadeiro/falso inconsistente."});
const version=z.object({revision:z.number().int().min(0),title:z.string().trim().min(1).max(120),content:z.string().max(24000),created:time});
const material=z.object({id,deck_id:id,title:z.string().trim().min(1).max(120),content:z.string().max(24000),revision:z.number().int().min(0),created:time,updated:time,versions:z.array(version).max(20).default([])});
export const backupSchema=z.object({version:z.literal(2),exportedAt:z.string().max(100),decks:z.array(z.object({id,title:z.string().trim().min(1).max(120),description:z.string().max(500),color:z.enum(['violet','peach','green','blue']),source:z.string().max(24000),parent_id:id.nullable().optional(),created:time,cards:z.array(card).max(900)})).max(30),reviews:z.array(z.object({deck_id:id,card_id:id,rating:z.enum(['again','hard','good','easy']),created:time})).max(3000),messages:z.array(z.object({deck_id:id,role:z.enum(['user','assistant']),content:z.string().max(30000),created:time,references:z.array(tutorReferenceSchema).max(12).optional()})).max(1000),materials:z.array(material).max(100).default([])});
export function prepareRestore(value:unknown,newId:()=>string=()=>crypto.randomUUID()){
 const input=backupSchema.parse(value),deckIds=new Map<string,string>(),cardIds=new Map<string,string>(),cardDeck=new Map<string,string>();
 for(const d of input.decks){if(deckIds.has(d.id))throw Error('Há identificadores de baralho repetidos no backup.');deckIds.set(d.id,newId());for(const c of d.cards){if(cardIds.has(c.id))throw Error('Há identificadores de cartão repetidos no backup.');cardIds.set(c.id,newId());cardDeck.set(c.id,d.id);}}
 if(cardIds.size>900)throw Error('Restaure até 900 cartões por vez.');
 const parents=new Map(input.decks.map(deck=>[deck.id,deck.parent_id]));
 for(const deck of input.decks){const seen=new Set<string>();let current:string|null|undefined=deck.id;while(current){if(seen.has(current))throw Error('A hierarquia contém um ciclo de subbaralhos.');seen.add(current);const parent=parents.get(current);if(parent&&!deckIds.has(parent))throw Error('Um subbaralho faz referência a um pai ausente.');current=parent;}}
 const decks=input.decks.map(d=>({id:deckIds.get(d.id)!,title:d.title,description:d.description,color:d.color,source:d.source,created:d.created,parent_id:d.parent_id?deckIds.get(d.parent_id)!:null}));
 const materialIds=new Map<string,string>();
 for(const note of input.materials){if(materialIds.has(note.id))throw Error('Há identificadores de nota repetidos.');if(!deckIds.has(note.deck_id))throw Error('Uma nota aponta para um baralho ausente.');if(new Set(note.versions.map(v=>v.revision)).size!==note.versions.length||note.versions.some(v=>v.revision>note.revision))throw Error('Histórico de nota inválido.');materialIds.set(note.id,newId());}
 const materialDecks=new Map(input.materials.map(note=>[note.id,note.deck_id]));
 const materials=input.materials.map(note=>({...note,id:materialIds.get(note.id)!,deck_id:deckIds.get(note.deck_id)!}));
 const cards=input.decks.flatMap(d=>d.cards.map(c=>{const details=c.details?{...c.details}:undefined;if(details?.materialId){if(materialDecks.get(details.materialId)!==d.id)throw Error('Um cartão aponta para uma nota ausente ou de outro baralho.');details.materialId=materialIds.get(details.materialId)!;}return {...c,...(details?{details}:{}),id:cardIds.get(c.id)!,deck_id:deckIds.get(d.id)!};}));
 const reviews=input.reviews.map(r=>{const deck_id=deckIds.get(r.deck_id);if(!deck_id)throw Error('Uma revisão faz referência a um baralho ausente.');const existingDeck=cardDeck.get(r.card_id);if(existingDeck&&existingDeck!==r.deck_id)throw Error('Uma revisão aponta para um cartão de outro baralho.');return {...r,id:newId(),deck_id,card_id:cardIds.get(r.card_id)||newId()};});
 const messages=input.messages.map(m=>{const deck_id=deckIds.get(m.deck_id);if(!deck_id)throw Error('Uma conversa faz referência a um baralho ausente.');return {...m,id:newId(),deck_id};});
 return {decks,cards,reviews,messages,materials};
}
