// Storage limits are independent of the AI provider's per-request file limit.
export const FILE_LIMITS={pdf:100_000_000,image:3_000_000,chunk:2_000_000,storage:200_000_000,count:20} as const;
export function isMaterialFilePart(index:number){
 return Number.isInteger(index)&&index>=0&&index<Math.ceil(FILE_LIMITS.pdf/FILE_LIMITS.chunk);
}
