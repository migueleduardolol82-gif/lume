export const searchKey=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/gu,'').toLocaleLowerCase('pt-BR').trim();
export const matchesSearch=(value:string,query:string)=>searchKey(value).includes(searchKey(query));
