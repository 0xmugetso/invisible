'use client';

import {Suspense, useEffect, useRef} from 'react';
import Link from 'next/link';
import {usePathname, useSearchParams} from 'next/navigation';
import {gsap} from 'gsap';

const navigation = [
  ['Overview','/dashboard/'],
  ['Leaderboard','/discovery/'],
  ['Deployments','/deployments/'],
  ['Ecosystem','/ecosystem/'],
  ['Research','/thesis/'],
] as const;

function Navigation({preserveMode = false}: {preserveMode?:boolean}) {
  const pathname = usePathname();
  return <nav aria-label="Workspace tabs">
    {navigation.map(([label,href])=>{
      const active = pathname===href || href==='/discovery/' && pathname.startsWith('/project/');
      return <Link key={href} href={preserveMode && href!=='/dashboard/' ? href+'?data=demo' : href} aria-current={active ? 'page' : undefined}>{label}</Link>;
    })}
  </nav>;
}

function DatasetNavigation() {
  return <Navigation preserveMode={useSearchParams().get('data')==='demo'}/>;
}

export default function Workspace({children}: {children:React.ReactNode}) {
  const pathname = usePathname();
  const content = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node = content.current;
    if (!node) return;
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)',()=>{
      gsap.fromTo(node,{opacity:.3,y:7},{opacity:1,y:0,duration:.35,ease:'power2.out',clearProps:'opacity,transform'});
    });
    return ()=>motion.revert();
  },[pathname]);

  return <div className="iv-workspace">
    <a className="iv-skip" href="#main-content">Skip to content</a>
    <header className="iv-app-header">
      <div className="iv-app-header-inner">
        <Link className="iv-wordmark" href="/dashboard/"><i aria-hidden="true"/> Invisible</Link>
        <Suspense fallback={<Navigation/>}><DatasetNavigation/></Suspense>
        <Link className="iv-app-home" href="/">Back to site <span aria-hidden="true">↗</span></Link>
      </div>
    </header>
    <div ref={content} className="iv-app-content">{children}</div>
  </div>;
}
