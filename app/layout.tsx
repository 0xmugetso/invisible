import type {Metadata} from 'next';
import localFont from 'next/font/local';
import './style.css';

const technor=localFont({src:'../fonts/title/WEB/fonts/Technor-Variable.woff2',weight:'200 900',variable:'--font-technor',display:'swap'});
const supreme=localFont({src:[
  {path:'../fonts/body/WEB/fonts/Supreme-Variable.woff2',weight:'100 800',style:'normal'},
  {path:'../fonts/body/WEB/fonts/Supreme-VariableItalic.woff2',weight:'100 800',style:'italic'},
],variable:'--font-supreme',display:'swap'});
export const metadata:Metadata={title:'INVISIBLE — NEAR Intelligence',description:'Discover what’s growing before everyone starts talking about it.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en" className={technor.variable+" "+supreme.variable}><body>{children}</body></html>;}
