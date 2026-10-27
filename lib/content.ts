import {z} from 'zod';
import {cardTemplateSchema} from './card-templates.ts';
import {isReleasedCardType} from './release-features.ts';
export const cardDetailsSchema=z.object({origin:z.string().trim().max(200).optional(),sourceType:z.enum(['manual','text','pdf','image','material']).optional(),evidence:z.string().max(6000).optional(),evidenceStatus:z.enum(['matched_text','unverified_attachment','needs_review']).optional(),hint:z.string().trim().max(500).optional(),tags:z.array(z.string().trim().min(1).max(50)).max(10).optional(),alternatives:z.array(z.string().trim().min(1).max(6000)).max(3).optional(),materialId:z.string().min(1).max(100).optional(),template:cardTemplateSchema.optional()}).strict();
export type CardDetails=z.infer<typeof cardDetailsSchema>;
export function isCardAnswerConsistent(card:{back:string;details?:CardDetails}):boolean{
 const template=card.details?.template;
 return template?.type!=='true_false'||card.back===(template.correct?'Verdadeiro':'Falso');
}
// Read schema preserves work in progress; write/restore schema prevents incomplete features entering the release.
export const releaseCardDetailsSchema=cardDetailsSchema.refine(details=>!details.template||isReleasedCardType(details.template.type),{message:'Este tipo de cartão ainda está em preparação. Use pergunta e resposta ou verdadeiro/falso nesta versão.'});
export const tutorReferenceSchema=z.object({id:z.string().max(200),label:z.string().max(300),text:z.string().max(2000),kind:z.enum(['note','card','source'])});
export type TutorReference=z.infer<typeof tutorReferenceSchema>;
export type MaterialNote={id:string;deck_id:string;title:string;content:string;revision:number;created:number;updated:number};
export type MaterialVersion={revision:number;title:string;content:string;created:number};
export type MaterialFile={id:string;deck_id:string;name:string;type:string;bytes:number;sha256:string|null;created:number;status:'uploading'|'ready'};
export {FILE_LIMITS,isMaterialFilePart} from './file-limits.ts';
