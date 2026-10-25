import './globals.css';
import './workspace.css';
export const metadata={title:'Lume — seu espaço de estudo',description:'Cartões, revisão e tutor no seu ritmo.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'Lume',statusBarStyle:'default' as const},icons:{icon:[{url:'/favicon.svg',type:'image/svg+xml'},{url:'/icon-192.png',type:'image/png',sizes:'192x192'}],apple:[{url:'/apple-touch-icon.png',sizes:'180x180',type:'image/png'}]}};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover' as const,themeColor:'#8060ac'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>;}
