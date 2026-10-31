import {z} from 'zod';
import {normalizeAnswer} from './study.ts';
export const lessonStepSchema=z.object({front:z.string().min(1).max(2000),back:z.string().min(1).max(6000)}).strict();
export const learningPayloadSchema=z.object({
 steps:z.array(lessonStepSchema).max(50).default([]),
 index:z.number().int().min(0).max(50).default(0),
 answers:z.array(z.object({answer:z.string().max(6000),rating:z.enum(['again','good']),eventId:z.string().min(1).max(100)}).strict()).max(50).default([]),
 messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(20000),eventId:z.string().min(1).max(100).optional(),references:z.array(z.object({id:z.string().max(200),label:z.string().max(300),text:z.string().max(2000),kind:z.enum(['note','card','source'])})).max(12).optional()}).strict()).max(100).default([]),
}).strict().superRefine((p,ctx)=>{
 if(p.index!==p.answers.length||p.index>p.steps.length)ctx.addIssue({code:'custom',message:'Progresso inválido.'});
});
export type LearningPayload=z.infer<typeof learningPayloadSchema>;
export type LearningSession={id:string;deck_id:string;kind:'lesson'|'chat';title:string;payload:LearningPayload;revision:number;created:number;updated:number};
export function newLesson(cards:readonly {front:string;back:string}[]):LearningPayload{
 if(!cards.length||cards.length>50)throw Error('Escolha de 1 a 50 cartões por aula.');
 return learningPayloadSchema.parse({steps:cards.map(({front,back})=>({front,back}))});
}
export function advanceLesson(payload:LearningPayload,input:{answer:string;rating:'again'|'good';eventId:string;index:number}):LearningPayload{
 if(payload.answers.some(a=>a.eventId===input.eventId))return payload;
 if(payload.index!==input.index||payload.index>=payload.steps.length)throw Error('Esta aula mudou. Reabra para continuar.');
 if(!normalizeAnswer(input.answer))throw Error('Escreva sua resposta antes de avançar.');
 return learningPayloadSchema.parse({...payload,index:payload.index+1,answers:[...payload.answers,{answer:input.answer,rating:input.rating,eventId:input.eventId}]});
}
