import {transformSync} from 'esbuild';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const file of ['app/lume.tsx','app/bulk-import.tsx','app/choice-quiz.tsx','lib/interaction.ts','lib/quiz-feedback.ts','lib/tsv.ts','app/deck-workspace.tsx','app/deck-materials.tsx','app/study-path.tsx','lib/study-path.ts','lib/material-draft.ts','app/material-library.tsx','app/card-editor.tsx','app/generate-cards.tsx','lib/generation.ts','lib/pdf-generation.ts','lib/material-files.ts','lib/content.ts','lib/file-limits.ts','lib/sync.ts','lib/choice-quiz.ts','lib/card-templates.ts','lib/drafts.ts','lib/release-features.ts','app/draft-recovery.tsx','app/template-quiz.tsx']){
 const source=await readFile(path.join(root,file),'utf8');
 const transformed=transformSync(source,{loader:file.endsWith('.tsx')?'tsx':'ts',format:'esm',jsx:'automatic',target:'node22'}).code.replace(/from (["'])(\.\.?\/[^"']+)\1/g,(_match,quote,specifier)=>`from ${quote}${specifier.replace(/\.tsx?$/,'')}.mjs${quote}`);
 const code=transformed.replace(/import\((["'])(\.\.?\/[^"']+)\1\)/g,(_match,quote,specifier)=>`import(${quote}${/\.mjs$/.test(specifier)?specifier:specifier.replace(/\.tsx?$/,'')+'.mjs'}${quote})`);
 const destination=path.join(root,'.test-artifacts',file.replace(/\.tsx?$/,'.mjs'));
 await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,code);
}

await mkdir(path.join(root,".test-artifacts/lib/vendor"),{recursive:true});
await writeFile(path.join(root,".test-artifacts/lib/vendor/pdf-lib.mjs"),await readFile(path.join(root,"lib/vendor/pdf-lib.mjs")));
