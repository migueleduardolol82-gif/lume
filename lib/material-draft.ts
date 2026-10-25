export type MaterialDraft={text:string;baseline:string};
export const createMaterialDraft=(source:string):MaterialDraft=>({text:source,baseline:source});
export const editMaterialDraft=(draft:MaterialDraft,text:string):MaterialDraft=>({...draft,text});
export const materialSave=(draft:MaterialDraft)=>({source:draft.text,expectedSource:draft.baseline});
export const confirmMaterialSave=(draft:MaterialDraft):MaterialDraft=>({...draft,baseline:draft.text});
