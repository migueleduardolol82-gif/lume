import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {GENERATION_LIMITS} from './generation.ts';
const ticketSchema=z.object({kind:z.enum(['upload','part','file']),owner:z.string(),deckId:z.string(),id:z.string().regex(/^[a-zA-Z0-9_-]+$/),bytes:z.number().int().positive().max(GENERATION_LIMITS.pdfPartBytes),expires:z.number(),index:z.number().int().nonnegative().optional(),uploadId:z.string().optional()});
export type UploadTicket=z.infer<typeof ticketSchema>;
function secret(){const key=process.env.OPENAI_API_KEY;if(!key)throw Error('Upload signing unavailable');return createHmac('sha256',key).update('lume-upload-ticket-v1').digest();}
export function signTicket(ticket:UploadTicket){const body=Buffer.from(JSON.stringify(ticketSchema.parse(ticket))).toString('base64url');return body+'.'+createHmac('sha256',secret()).update(body).digest('base64url');}
export function readTicket(value:string,owner:string,deckId:string,kind:UploadTicket['kind']){
 if(value.length>3000)throw Error('Invalid upload ticket');const [body,mac,...rest]=value.split('.');if(!body||!mac||rest.length)throw Error('Invalid upload ticket');
 const expected=createHmac('sha256',secret()).update(body).digest(),actual=Buffer.from(mac,'base64url');if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw Error('Invalid upload ticket');
 const ticket=ticketSchema.parse(JSON.parse(Buffer.from(body,'base64url').toString('utf8')));
 if(ticket.owner!==owner||ticket.deckId!==deckId||ticket.kind!==kind||ticket.expires<=Date.now())throw Error('Expired or invalid upload ticket');return ticket;
}
