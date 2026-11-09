import type {Metadata} from 'next';
import './style.css';
import NetworkBackground from './network-background';
export const metadata:Metadata={title:'INVISIBLE — NEAR Intelligence',description:'Discover what’s growing before everyone starts talking about it.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body><NetworkBackground/>{children}</body></html>;}
