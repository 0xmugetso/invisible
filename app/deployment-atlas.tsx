'use client';
import WorkspaceHeading from './workspace-heading';
import DataSkeleton from './data-skeleton';

import {Suspense, useEffect, useMemo, useState, type MouseEvent} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import Icon from './interface-icon';
import ProjectPagination from './project-pagination';
import {LiveActivity} from './onchain-evidence';
import {deploymentAccounts, deploymentProjects, DeploymentAttributions, DeploymentProjectDirectory, ProjectDeploymentEvidence, WarehouseContractEvidence} from './deployment-projects';
import projects from '../data/projects.json';
import {dateAt} from '../lib/model.mjs';
import {CohortSculpture, CountUp} from './research-graphics';
import './discovery-ranking.css';

type Method = [method:string, transactions:number, signers:number, example:string];
type Entry = [contract:string,a:number,b:number,c:number,ab:number,bc:number,abc:number,week:number,previousWeek:number,transactions:number,days:number,lastActive:string|null,lastDeployment:string|null,examples:string[],methods:Method[]];
export type Snapshot = {end:string; exportedAt:string; rows:Entry[]};
const fmt = (value:number) => value.toLocaleString('en-US');
const percent = (value:number) => `${Math.round(value*100)}%`;
const names = new Map(projects.flatMap(project=>project.contracts.map(contract=>[contract,project.name] as const)));
for (const [account, matches] of deploymentAccounts) names.set(account,matches.map(({project})=>project.name).join(' / '));
const pageSize = 12;
function ranks(values:number[]) {
  const sorted = [...values].sort((a,b)=>a-b);
  const result = new Map<number,number>();
  for(let start=0;start<sorted.length;){
    let end=start+1;
    while(end<sorted.length&&sorted[end]===sorted[start])end++;
    result.set(sorted[start],(start+end)/2/sorted.length);
    start=end;
  }
  return result;
}

const explorerDescription='See how individual NEAR accounts are used. A project may use several contracts. The directory also includes token and infrastructure accounts.';

function DeploymentPlaceholder() {
  return <div className="iv-deployment-placeholder" role="status" aria-label="Loading contract activity">
    <WorkspaceHeading title="NEAR Contract Explorer" description={explorerDescription}/>
    <div className="iv-card iv-deployment-chart-placeholder" aria-hidden="true"><i className="iv-skeleton-line"/><div className="iv-skeleton-columns"><i/><i/><i/><i/><i/><i/></div></div>
    <DataSkeleton label="Loading contract directory"/>
  </div>;
}

export default function DeploymentAtlas(props:{snapshotPath?:string; compact?:boolean}) {
  return <Suspense fallback={<DeploymentPlaceholder/>}>
    <Atlas {...props}/>
  </Suspense>;
}

function Atlas({snapshotPath = '/deployments.json', compact = false}: {snapshotPath?:string; compact?:boolean}) {
  const params=useSearchParams();
  const account=compact ? '' : params.get('contract') ?? '';
  const projectId=compact ? '' : params.get('project') ?? '';
  const requestedSort=compact ? '' : params.get('sort');
  const [snapshot,setSnapshot] = useState<Snapshot|null>(null);
  const [failed,setFailed] = useState(false);
  const [mappedOnly,setMappedOnly] = useState(false);
  const [query,setQuery] = useState('');
  const [sort,setSort] = useState('score');
  const [page,setPage] = useState(0);
  useEffect(()=>{
    setSort(requestedSort && ['repeat','growth','signers'].includes(requestedSort) ? requestedSort : 'score');
    setPage(0);
  },[requestedSort]);
  useEffect(()=>{
    if (projectId) return;
    const controller = new AbortController();
    fetch(snapshotPath,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}).then(response=>{
      if(!response.ok) throw new Error('Export unavailable');
      return response.json();
    }).then(next => {
      if (controller.signal.aborted || !Array.isArray(next.rows)) return;
      setSnapshot(next);
      setFailed(false);
    }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return () => controller.abort();
  },[snapshotPath,projectId]);

  const scored = useMemo(()=>{
    if(!snapshot)return [];
    const eligible=snapshot.rows.filter(row=>row[2]>=50&&row[3]>=50&&row[8]>=10);
    const week=ranks(eligible.map(row=>row[7]/row[8]-1));
    const month=ranks(eligible.map(row=>row[3]/row[2]-1));
    const retention=ranks(eligible.map(row=>row[5]/row[2]));
    return snapshot.rows.map(row=>{
      const g=row[2]?row[3]/row[2]-1:null;
      const r=row[2]?row[5]/row[2]:null;
      const w=row[8]?row[7]/row[8]-1:null;
      const score=eligible.length>=3&&row[2]>=50&&row[3]>=50&&row[8]>=10
        ?Math.round(100*(10*week.get(w!)!+30*month.get(g!)!+30*retention.get(r!)!)/70):null;
      return {row,g,r,score};
    });
  },[snapshot]);

  const filtered = useMemo(()=>{
    const needle=query.trim().toLowerCase();
    const value = (item:typeof scored[number])=>sort==='growth'?item.g:sort==='repeat'?item.row[5]-item.row[4]:sort==='signers'?item.row[3]:item.score;
    return scored.filter(({row})=>(!mappedOnly || names.has(row[0])) && (row[0].includes(needle)||names.get(row[0])?.toLowerCase().includes(needle)))
      .sort((a,b)=>(value(b)??-Infinity)-(value(a)??-Infinity)||a.row[0].localeCompare(b.row[0]));
  },[scored,query,sort,mappedOnly]);

  function openContract(event:MouseEvent<HTMLAnchorElement>) {
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    window.history.pushState(null,'',event.currentTarget.href);
    window.scrollTo(0,0);
  }

  if (compact) {
    const ranked = filtered.filter(item => item.score !== null);
    const leaders = ranked.slice(0,10);
    return <section className="discovery-ranking iv-ready-fade" aria-labelledby="contract-leaders">
      <div className="section-title">
        <h2 id="contract-leaders">Top NEAR contracts</h2>
        <Link className="method-link" href="/app/deployments/">Explore all contracts ↗</Link>
      </div>
      <p>{snapshot
        ? `By Discovery score · ${fmt(ranked.length)} qualified of ${fmt(scored.length)} contracts · Snapshot through ${dateAt(snapshot.end,-1)} UTC`
        : failed ? 'The contract ranking snapshot is unavailable.' : 'Loading the contract ranking snapshot…'}</p>
      {leaders.length > 0 ? <table>
        <thead><tr><th scope="col">Rank</th><th scope="col">Contract</th><th scope="col">28-day signers</th><th scope="col">Returning</th><th scope="col">Score</th></tr></thead>
        <tbody>{leaders.map(({row,score,r}, index) => <tr key={row[0]}>
          <td>{index+1}</td>
          <th scope="row"><Link href={'/app/deployments/?contract='+encodeURIComponent(row[0])}>{row[0]}</Link>
            {names.has(row[0]) && <small>{names.get(row[0])}</small>}
          </th>
          <td>{fmt(row[3])}</td><td>{r === null ? '—' : percent(r)}</td><td>{score}</td>
        </tr>)}</tbody>
      </table> : snapshot && <p>Too few contracts meet the signer thresholds to rank this snapshot.</p>}
    </section>;
  }
  if(projectId) {
    const project=deploymentProjects.find(entry=>entry.id===projectId);
    return project ? <ProjectDeploymentEvidence project={project}/> : <section className="detail-head"><h1>Project Evidence Unavailable</h1><Link className="back" href="/app/deployments/#deployment-projects">← Project directory</Link></section>;
  }
  if (!snapshot && !failed) return <DeploymentPlaceholder/>;
  if(account && deploymentAccounts.has(account) && !scored.some(item=>item.row[0]===account)) return <>
    <Link className="back" href="/app/deployments/#deployment-projects">← Project directory</Link>
    <section className="deployment-hero"><div><h1>{account}</h1>
      <p>{snapshot ? 'The activity export has no row for this account.' : failed ? 'The activity export is temporarily unavailable.' : 'Loading the activity export…'}</p>
      <a className="feature-link" href={'https://nearblocks.io/address/'+encodeURIComponent(account)}>Open on NearBlocks <Icon name="launch"/></a>
    </div></section>
    <DeploymentAttributions account={account}/>
    <WarehouseContractEvidence key={account} account={account}/>
  </>;
  if(!snapshot)return <><WorkspaceHeading title="NEAR Contract Explorer" description="The activity export is unavailable."/>{!account && <DeploymentProjectDirectory/>}</>;
  const selected=account?scored.find(item=>item.row[0]===account):null;
  if(account&&!selected)return <section className="detail-head"><h1>Contract Outside This Snapshot</h1><p>{account}</p><Link className="back" href="/app/deployments/">← Deployment directory</Link></section>;
  const dates=`${dateAt(snapshot.end,-84)} to ${dateAt(snapshot.end,-1)} UTC`;
  if(selected){
    const {row,score,g,r}=selected;
    const [contract,first,prior,current,priorRepeat,repeat,again,,,transactions,days,lastActive,lastDeployment,examples,methods]=row;
    return <>
      <a className="back" href={sort==='score'?'/app/deployments/':'/app/deployments/?sort='+sort} onClick={openContract}>← Deployment directory</a>
      <section className="deployment-hero">
        <div><h1>{names.get(contract)??contract}</h1>{names.has(contract)&&<p><code>{contract}</code></p>}
        <p>{dates} · Direct onchain activity</p><a className="feature-link" href={'https://nearblocks.io/address/'+contract}>Inspect contract ↗</a></div>
        <CohortSculpture counts={[first,prior,current]}/>
      </section>
      <div className="stats deployment-stats">
        {[
          ['Discovery score',score??'—',score===null?'Below the cohort size threshold':'Adoption and returning share percentile'],
          ['Latest active signers',fmt(current),g===null?'No prior baseline':`${g>=0?'+':''}${percent(g)} vs. previous window`],
          ['Repeat signers',fmt(repeat),r===null?'No prior signers':`${percent(r)} of previous signers returned`],
          ['Returned in all three windows',fmt(again),priorRepeat?`${percent(again/priorRepeat)} of the earlier repeat cohort`:'No earlier repeat cohort'],
        ].map(([label,value,note])=><div className="stat" key={label}><span>{label}</span><strong><CountUp value={value}/></strong><small>{note}</small></div>)}
      </div>
      <DeploymentAttributions account={contract}/>
      <div className="columns">
        <section className="panel"><h2>What Changed?</h2>
          <p>{fmt(repeat)} signers appeared in both recent windows, compared with {fmt(priorRepeat)} across the earlier pair. That is a change of {repeat-priorRepeat>=0?'+':''}{fmt(repeat-priorRepeat)} repeat signers.</p>
          <p>{fmt(transactions)} distinct direct call attempts across {fmt(days)} of the latest 28 days. {lastActive?`Last observed call: ${lastActive} UTC.`:''}</p>
          <p>{lastDeployment?`Last direct deployment or code attachment action in this snapshot: ${lastDeployment} UTC.`:'No direct deployment or code attachment action was observed in these 84 days.'}</p>
          {examples.length>0&&<p>{examples.map((tx,i)=><a className="tx-example" key={tx} href={'https://nearblocks.io/txns/'+tx}>Recent transaction {i+1} ↗</a>)}</p>}
        </section>
        <section className="panel"><h2>What Repeat Signers Called</h2>
          <p>Methods called in the middle window by signers who also appeared in the first window.</p>
          {methods.length?<ul className="method-list">{methods.map(([method,tx,signers,example])=><li key={method}><code>{method}</code><span>{fmt(signers)} signers · {fmt(tx)} tx</span><a href={'https://nearblocks.io/txns/'+example}>Example ↗</a></li>)}</ul>:<p>No decoded method evidence for that cohort.</p>}
        </section>
      </div>
      <p className="atlas-source">Counts measure signer accounts and direct call attempts, including failures. A contract account may represent a service, token, or shared relayer. <a href="https://github.com/near/near-public-lakehouse">NEAR Public Lakehouse ↗</a></p>
    </>;
  }
  const currentPage=Math.max(0,Math.min(page,Math.ceil(filtered.length/pageSize)-1));
  const visible=filtered.slice(currentPage*pageSize,(currentPage+1)*pageSize);
  const mapped=scored.filter(({row})=>names.has(row[0])).length;
  return <>
    <WorkspaceHeading title="NEAR Contract Explorer" description={explorerDescription}
      actions={<div className="iv-snapshot"><Icon name="contracts"/>{dates}</div>}/>
    <div className="iv-deployment-live"><LiveActivity/></div>
    <div className="iv-metrics">
      <div className="iv-card iv-metric"><span>Contracts in Snapshot</span><strong><CountUp value={fmt(scored.length)}/></strong><p>Accounts covered by this activity export</p></div>
      <div className="iv-card iv-metric"><span>Mapped to Projects</span><strong><CountUp value={fmt(mapped)}/></strong><p>Contracts with a project attribution</p></div>
      <div className="iv-card iv-metric"><span>Eligible for a Score</span><strong><CountUp value={fmt(scored.filter(item=>item.score!=null).length)}/></strong><p>Meet the minimum signer thresholds</p></div>
    </div>
    <section className="iv-card iv-contract-directory iv-ready-fade" aria-labelledby="iv-directory-title">
      <div className="iv-observed-head">
        <div><h2 id="iv-directory-title">Contract Activity</h2><p>Open a contract to inspect signer cohorts and example transactions. <a className="iv-text-link" href="#deployment-projects">Browse by project</a></p></div>
        <label className="iv-find"><Icon name="search"/><input aria-label="Search contract or project name" placeholder="Search contract or project" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>
      </div>
      <div className="iv-observed-tools">
        <div className="iv-switch" aria-label="Contract scope">
          <button type="button" aria-pressed={!mappedOnly} onClick={()=>{setMappedOnly(false);setPage(0);}}><Icon name="contracts"/>All contracts</button>
          <button type="button" aria-pressed={mappedOnly} onClick={()=>{setMappedOnly(true);setPage(0);}}><Icon name="overview"/>Project-mapped</button>
        </div>
        <label className="iv-sort"><span>Sort by</span><select value={sort} onChange={e=>{setSort(e.target.value);setPage(0);}}><option value="score">Activity score</option><option value="repeat">Repeat signer change</option><option value="signers">Active signers</option><option value="growth">28-day growth</option></select></label>
      </div>
      {visible.length ? <ul className="iv-contract-rows">
        {visible.map(({row,score})=>{
          const [contract,,,,earlier,later] = row;
          const gain=later-earlier;
          return <li key={contract}>
            <a href={'/app/deployments/?contract='+encodeURIComponent(contract)} onClick={openContract}>
              <div><strong>{contract}</strong><small>{names.get(contract) ?? 'Project attribution unavailable'}</small></div>
              <div><strong>{fmt(row[3])}</strong><small>28-day signers</small></div>
              <div><strong className={gain>0 ? 'contract-gain' : undefined}>{gain>0 ? '+' : ''}{fmt(gain)}</strong><small>Repeat signer change</small></div>
              <div><strong>{score ?? '—'}</strong><small>Activity score</small></div>
              <Icon name="right"/>
            </a>
          </li>;
        })}
      </ul> : <p className="ranking-empty">No contracts match your search.</p>}
      <ProjectPagination label="Contracts" page={currentPage} pageSize={pageSize} total={filtered.length} onPageChange={setPage}/>
    </section>
    <DeploymentProjectDirectory/>
    <p className="atlas-source">Repeat signer change compares the first two and last two of three 28-day windows. Counts include failed direct call attempts. <a href="https://github.com/near/near-public-lakehouse">NEAR Public Lakehouse ↗</a></p>
  </>;
}
