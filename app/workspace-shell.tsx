'use client';

import {BrandMotion} from './brand-motion';
import {Suspense} from 'react';
import Link from 'next/link';
import {usePathname, useSearchParams} from 'next/navigation';
import Icon from './interface-icon';
import MobileNavigation from './mobile-navigation';

const navigation = [
  ['Overview','overview','/app/'],
  ['Leaderboard','ranking','/app/discovery/'],
  ['Deployments','contracts','/app/deployments/'],
  ['Ecosystem','ecosystem','/app/ecosystem/'],
] as const;

function Navigation({dataset}: {dataset?:'forecast'|'observed'}) {
  const pathname = usePathname();
  return <nav aria-label="Workspace tabs">
    {navigation.map(([label,icon,href])=>{
      const active = pathname===href || href==='/app/discovery/' && pathname.startsWith('/app/project/');
      return <Link key={href} href={dataset && href!=='/app/' && href!=='/app/deployments/' ? href+'?data='+dataset : href} aria-current={active ? 'page' : undefined}><Icon name={icon}/>{label}</Link>;
    })}
  </nav>;
}

function DatasetNavigation() {
  const dataset = useSearchParams().get('data');
  return <Navigation dataset={dataset==='demo' ? 'forecast' : dataset==='forecast' || dataset==='observed' ? dataset : undefined}/>;
}

export default function Workspace({children,account}: {children:React.ReactNode;account?:React.ReactNode}) {
  const pathname=usePathname();
  return <div className="iv-workspace">
    <a className="iv-skip" href="#main-content">Skip to content</a>
    <header className="iv-app-header">
      <div className="iv-app-header-inner">
        <Link className="iv-wordmark" href="/"><BrandMotion/> Invisible</Link>
        <MobileNavigation>
          <Suspense fallback={<Navigation/>}><DatasetNavigation/></Suspense>
        </MobileNavigation>
        <div className="iv-app-actions">
          <Link className="iv-route-button iv-app-docs" href="/docs/" aria-label="Docs"><Icon name="research"/><span>Docs</span></Link>
          {account}
        </div>
      </div>
    </header>
    <div className="iv-app-content">{children}</div>
    {account && pathname!=='/app/' && <footer className="iv-workspace-footer">
      <Link className="iv-wordmark" href="/"><BrandMotion/> Invisible</Link>
      <nav aria-label="Workspace footer">
        <Link href="/docs/#investment-methodology"><Icon name="ranking"/> Methodology</Link>
        <Link href="/docs/#sources"><Icon name="contracts"/> Data Sources</Link>
        <Link href="/"><Icon name="globe"/> Website</Link>
      </nav>
    </footer>}
  </div>;
}
