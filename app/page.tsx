import Lume from './lume';
import {getOwner} from '../lib/auth';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getOwner();if(!user)return <main className="empty"><h1>Seu espaço está protegido.</h1><p>Acesse pela publicação privada na Vercel. A prévia local precisa ser iniciada em modo de teste.</p></main>;return <Lume/>;}
