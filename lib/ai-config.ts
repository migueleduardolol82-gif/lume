type Env=Record<string,string|undefined>;
const efforts=['minimal','low','medium','high','xhigh','max'] as const;
export function aiConfig(env:Env){
 const model=env.OPENAI_MODEL?.trim()||'gpt-5-mini';
 const modern=/^gpt-6(?:[.-]|$)/.test(model);
 const effort=env.OPENAI_REASONING_EFFORT?.trim()||(modern?'medium':'minimal');
 if(!efforts.includes(effort as typeof efforts[number]))throw Error('Nível de raciocínio inválido.');
 if(modern&&effort==='minimal')throw Error('Nível de raciocínio incompatível com este modelo. Use medium, por exemplo.');
 const maxOutputTokens=env.OPENAI_MAX_OUTPUT_TOKENS?Number(env.OPENAI_MAX_OUTPUT_TOKENS):(modern?12000:4000);
 if(!Number.isInteger(maxOutputTokens)||maxOutputTokens<512||maxOutputTokens>32000)throw Error('Configure entre 512 e 32000 tokens de saída.');
 return {model,effort,maxOutputTokens};
}
