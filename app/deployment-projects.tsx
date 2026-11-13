'use client';
import DataSkeleton from './data-skeleton';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import registry from '../data/activity-registry.json';
import Icon from './interface-icon';
import ProjectMark from './project-mark';
import ProjectPagination from './project-pagination';
import {getResearch} from './use-research-board';

type Related = {account:string; role:string; source:string; explorer?:string};
type Project = {id:string;name:string;description:string;contracts:Record<string,string|undefined>; tokens:{accountId:string;symbol:string;evidence:string}[];
  links:Record<string,string|{url:string;evidence:string}|undefined>; measurement?:string; relatedDeployments?:Related[]};
export const deploymentProjects:readonly Project[]=registry;

function projectAccounts(project:Project) {
  const related=new Map<string,Related>();
  for (const token of project.tokens) related.set(token.accountId,{account:token.accountId,role:token.symbol+' token',source:token.evidence});
  for (const [account,source] of Object.entries(project.contracts)) {
    if (source) related.set(account,{account,role:'Project contract',source});
  }
  for (const item of project.relatedDeployments ?? []) related.set(item.account,item);
  return [...related.values()];
}

export const deploymentAccounts = new Map<string,{project:Project;deployment:Related}[]>();
for (const project of deploymentProjects) {
  for (const deployment of projectAccounts(project)) {
    if (deployment.explorer) continue;
    const matches=deploymentAccounts.get(deployment.account) ?? [];
    matches.push({project,deployment});
    deploymentAccounts.set(deployment.account,matches);
  }
}

type ContractActivity={account:string; current_signers:number; prior_signers:number; repeat_signers:number; example_transaction:string|null};

export function WarehouseContractEvidence({account}:{account:string}) {
  const project=deploymentAccounts.get(account)?.find(entry=>entry.project.contracts[account])?.project;
  const [resolvedAccount,setResolvedAccount]=useState('');
  const [record,setRecord]=useState<{cutoff:string;entry:ContractActivity}|null>(null);
  useEffect(()=>{
    if (!project) return;
    const controller=new AbortController();
    getResearch<{cutoff:string|null;contractActivity:ContractActivity[]|null}>({view:'project-core',id:project.id},controller.signal)
      .then(data=>{
        const entry=data.contractActivity?.find(row=>row.account===account);
        if (!controller.signal.aborted && data.cutoff && entry) setRecord({cutoff:data.cutoff,entry});
      }).catch(()=>{}).finally(()=>{if (!controller.signal.aborted) setResolvedAccount(account);});
    return ()=>controller.abort();
  },[account,project]);
  if (project && resolvedAccount!==account) return <DataSkeleton variant="cards" label="Loading measured signer activity"/>;
  if (!record || record.entry.account!==account) return null;
  const {entry,cutoff}=record;
  const fmt=(value:number)=>value.toLocaleString('en-US');
  return <section className="iv-card iv-deployment-attribution">
    <h2>Measured Signer Activity</h2><p>Latest 28-day window through {new Date(Date.parse(cutoff)-1).toISOString().slice(0,10)} UTC</p>
    <dl className="iv-market-grid">
      <div><dt>Latest signers</dt><dd>{fmt(entry.current_signers)}</dd></div>
      <div><dt>Previous signers</dt><dd>{fmt(entry.prior_signers)}</dd></div>
      <div><dt>Returning Signers</dt><dd>{fmt(entry.repeat_signers)}</dd></div>
    </dl>
    {entry.example_transaction && <a href={'https://nearblocks.io/txns/'+entry.example_transaction}>Example call <Icon name="launch"/></a>}
  </section>;
}

export function DeploymentAttributions({account}:{account:string}) {
  const matches=deploymentAccounts.get(account);
  if (!matches?.length) return null;
  return <section className="iv-card iv-deployment-attribution">
    <h2>Project Attribution</h2>
    <ul>{matches.map(({project,deployment})=><li key={project.id}>
      <Link href={'/app/deployments/?project='+project.id}>{project.name}</Link>
      <span>{deployment.role}</span>
      <a href={deployment.source}>Attribution source <Icon name="launch"/></a>
    </li>)}</ul>
  </section>;
}

export function ProjectDeploymentEvidence({project}:{project:Project}) {
  const accounts=projectAccounts(project);
  const docs=Object.entries(project.links).filter(([kind,link])=>link && ['documentation','product','website'].includes(kind));
  return <>
    <Link className="back" href="/app/deployments/#deployment-projects">← Project directory</Link>
    <section className="deployment-hero">
      <div><div className="iv-deployment-project-name"><ProjectMark id={project.id}/><h1>{project.name}</h1></div>
        <p>{project.description}</p>{project.measurement && <p>{project.measurement}</p>}
      </div>
    </section>
    <section className="iv-card iv-deployment-attribution">
      <h2>Deployment Evidence</h2>
      {accounts.length ? <ul>{accounts.map(({account,role,source,explorer})=><li key={account}>
        {explorer ? <a href={explorer}>{account}</a> : <Link href={'/app/deployments/?contract='+encodeURIComponent(account)}>{account}</Link>}
        <span>{role}</span><a href={source}>Attribution source <Icon name="launch"/></a>
      </li>)}</ul> : <p>A project-specific on-chain receiver has yet to be verified.</p>}
      {docs.length>0 && <div className="iv-dialog-links">{docs.map(([kind,link])=><a key={kind} href={typeof link==='string' ? link : link?.url}>
        {kind==='website' ? 'Project site' : kind==='product' ? 'Product source' : 'Documentation'} <Icon name="launch"/>
      </a>)}</div>}
    </section>
  </>;
}

export function DeploymentProjectDirectory() {
  const [query,setQuery]=useState('');
  const [page,setPage]=useState(0);
  const needle=query.trim().toLowerCase();
  const matching=deploymentProjects.filter(project=>[project.name,...projectAccounts(project).map(item=>item.account)].some(value=>value.toLowerCase().includes(needle)));
  const pageSize=6;
  return <section id="deployment-projects" className="iv-card iv-contract-directory" aria-labelledby="deployment-projects-title">
    <div className="iv-observed-head"><div><h2 id="deployment-projects-title">Project Deployment Evidence</h2><p>{deploymentProjects.length} reviewed projects with contract attribution or source links</p></div>
      <label className="iv-find"><Icon name="search"/><input aria-label="Find deployment evidence by project" value={query} placeholder="Search project or account" onChange={event=>{setQuery(event.target.value);setPage(0);}}/></label>
    </div>
    {matching.length ? <ul className="iv-contract-rows iv-deployment-project-rows">{matching.slice(page*pageSize,(page+1)*pageSize).map(project=><li key={project.id}>
      <Link href={'/app/deployments/?project='+project.id}><div className="iv-deployment-project-name"><ProjectMark id={project.id}/><strong>{project.name}</strong></div>
        <small>{projectAccounts(project).length ? projectAccounts(project).length+' attributed accounts' : 'Project sources'}</small><Icon name="right"/>
      </Link>
    </li>)}</ul> : <p className="ranking-empty">No projects match this search.</p>}
    <ProjectPagination label="Deployment projects" page={page} pageSize={pageSize} total={matching.length} onPageChange={setPage}/>
  </section>;
}
