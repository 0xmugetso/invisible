import Terminal from '../../terminal';
import projects from '../../../data/projects.json';
import {notFound} from 'next/navigation';
export const dynamicParams=false;
export function generateStaticParams(){return projects.map(({id})=>({id}));}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!projects.some(p=>p.id===id))notFound();return <Terminal view="project" id={id}/>;}
