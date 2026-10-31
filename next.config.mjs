import {realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// Linked local dependencies must be inside Turbopack's filesystem root.
// On Vercel a regular node_modules directory keeps the root at the app itself.
const appRoot=fileURLToPath(new URL('.',import.meta.url));
const dependencies=realpathSync(new URL('./node_modules',import.meta.url));
let root=appRoot;
while(path.relative(root,dependencies).startsWith('..')||path.isAbsolute(path.relative(root,dependencies)))root=path.dirname(root);
export default {turbopack:{root},serverExternalPackages:['pdfjs-dist','@napi-rs/canvas'],outputFileTracingIncludes:{'/api/lume/learning':['./node_modules/pdfjs-dist/**','./node_modules/@napi-rs/**']}};
