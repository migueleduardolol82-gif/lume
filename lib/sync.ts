/** Discards superseded reads, including transports that ignore cancellation. */
export class LatestRead {
 private sequence=0;
 private controller:AbortController|null=null;
 invalidate(){this.sequence++;this.controller?.abort();this.controller=null;}
 async run<T>(load:(signal:AbortSignal)=>Promise<T>):Promise<T|undefined>{
  this.invalidate();const sequence=this.sequence,controller=new AbortController();this.controller=controller;
  try{const value=await load(controller.signal);return sequence===this.sequence&&!controller.signal.aborted?value:undefined;}
  catch(error){if(sequence!==this.sequence||controller.signal.aborted)return undefined;throw error;}
  finally{if(this.controller===controller)this.controller=null;}
 }
}
export class RequestError extends Error{constructor(message:string,readonly status=0){super(message);this.name='RequestError';}}
export async function requestJson<T>(url:string,options:RequestInit={},timeoutMs=15000):Promise<T>{
 const controller=new AbortController(),external=options.signal;
 const cancel=()=>controller.abort();if(external?.aborted)cancel();else external?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(cancel,timeoutMs);
 try{
  const response=await fetch(url,{...options,signal:controller.signal});
  if(!response.headers.get('content-type')?.includes('application/json'))throw new RequestError(response.redirected?'Sua sessão expirou. Reabra o app para entrar.':'O servidor retornou uma resposta inesperada. Tente novamente.',response.redirected?401:response.status);
  const data=await response.json() as T&{error?:unknown};
  if(!response.ok)throw new RequestError(typeof data.error==='string'?data.error:'Não foi possível concluir a solicitação.',response.status);
  return data;
 }catch(error){if(error instanceof RequestError)throw error;if(controller.signal.aborted&&!external?.aborted)throw new RequestError('A conexão demorou demais. Verifique a internet e tente novamente.');if(external?.aborted)throw error;throw new RequestError('Não foi possível conectar ao servidor. Verifique a internet e tente novamente.');}
 finally{clearTimeout(timer);external?.removeEventListener('abort',cancel);}
}
