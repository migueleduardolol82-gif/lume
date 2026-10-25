export type PathCard={id:string;front:string;back:string;due:number;interval:number;details?:{tags?:string[]}};
export function buildStudyPath<T extends PathCard>(cards:readonly T[],now:number,stepSize=10){
 if(!Number.isInteger(stepSize)||stepSize<1||stepSize>100)throw Error('Tamanho de etapa inválido.');
 if(new Set(cards.map(card=>card.id)).size!==cards.length)throw Error('Cartões duplicados no caminho.');
 const steps:{id:string;title:string;cards:T[];reviewed:number;due:number}[]=[];
 for(let offset=0;offset<cards.length;offset+=stepSize){const group=cards.slice(offset,offset+stepSize);steps.push({id:group[0].id,title:`Etapa ${steps.length+1}`,cards:group,reviewed:group.filter(c=>c.interval>0).length,due:group.filter(c=>c.due<=now).length});}
 return steps;
}
export function buildThematicStudyPath<T extends PathCard>(cards:readonly T[],now:number,stepSize=10){
 // Validate the whole input, including duplicates across different themes.
 buildStudyPath(cards,now,stepSize);
 const groups=new Map<string,{theme:string;tagged:boolean;cards:T[]}>();
 for(const card of cards){
  const tag=card.details?.tags?.[0]?.normalize('NFC').trim().replace(/\s+/gu,' ')||'';
  const key=tag?'tag:'+tag.toLocaleLowerCase('pt-BR'):'untagged';
  if(!groups.has(key))groups.set(key,{theme:tag||'Revisão geral',tagged:Boolean(tag),cards:[]});
  groups.get(key)!.cards.push(card);
 }
 return [...groups.values()].flatMap(group=>buildStudyPath(group.cards,now,stepSize).map(step=>({...step,theme:group.theme,title:group.tagged?`${group.theme} · ${step.title}`:step.title})));
}
