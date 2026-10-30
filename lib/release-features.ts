// Enable only after template authoring, study, image ownership and backup pass the release gate.
export const RELEASE_FEATURES:Readonly<{cardTemplates:boolean}>=Object.freeze({cardTemplates:false});
export function isReleasedCardType(type:string):boolean{
 return type==='qa'||type==='true_false'||type==='cloze'||type==='multi_select'||type==='order'||type==='match'||RELEASE_FEATURES.cardTemplates;
}
