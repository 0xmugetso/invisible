'use client';

import {useEffect, useMemo, useState, type MouseEvent} from 'react';
import Link from 'next/link';
import projects from '../data/projects.json';
import {dateAt} from '../lib/model.mjs';
import {CohortSculpture, CountUp} from './research-graphics';

type Method = [method:string, transactions:number, signers:number, example:string];
type Entry = [contract:string,a:number,b:number,c:number,ab:number,bc:number,abc:number,week:number,previousWeek:number,transactions:number,days:number,lastActive:string|null,lastDeployment:string|null,examples:string[],methods:Method[]];
export type Snapshot = {end:string; exportedAt:string; rows:Entry[]};
const fmt = (value:number) => value.toLocaleString('en-US');
const percent = (value:number) => `${Math.round(value*100)}%`;
const names = new Map(projects.flatMap(project=>project.contracts.map(contract=>[contract,project.name] as const)));
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

export default function DeploymentAtlas({snapshotPath = '/deployments.json'}: {snapshotPath?:string}) {
  const [snapshot,setSnapshot] = useState<Snapshot|null>(null);
  const [failed,setFailed] = useState(false);
  const [query,setQuery] = useState('');
  const [sort,setSort] = useState('score');
  const [page,setPage] = useState(0);
  const [account,setAccount] = useState('');
  useEffect(()=>{
    function sync(){
      const params = new URLSearchParams(location.search);
      setAccount(params.get('contract') ?? '');
      const requestedSort = params.get('sort');
      setSort(requestedSort && ['repeat', 'growth', 'signers'].includes(requestedSort) ? requestedSort : 'score');
      setPage(0);
    }
    sync();
    window.addEventListener('popstate',sync);
    return () => window.removeEventListener('popstate',sync);
  },[]);
  useEffect(()=>{
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
  },[snapshotPath]);

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
    return scored.filter(({row})=>row[0].includes(needle)||names.get(row[0])?.toLowerCase().includes(needle))
      .sort((a,b)=>(value(b)??-Infinity)-(value(a)??-Infinity)||a.row[0].localeCompare(b.row[0]));
  },[scored,query,sort]);

  function openContract(event:MouseEvent<HTMLAnchorElement>,contract:string) {
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    window.history.pushState(null,'',event.currentTarget.href);
    setAccount(contract);
    window.scrollTo(0,0);
  }

  if(!snapshot)return <section className="detail-head"><h1>NEAR deployments</h1><p>{failed?'The deployment export is unavailable.':'Loading NEAR contract evidence…'}</p></section>;
  const selected=account?scored.find(item=>item.row[0]===account):null;
  if(account&&!selected)return <section className="detail-head"><h1>Contract outside this snapshot</h1><p>{account}</p><Link className="back" href="/deployments/">← Deployment directory</Link></section>;
  const dates=`${dateAt(snapshot.end,-84)} to ${dateAt(snapshot.end,-1)} UTC`;
  if(selected){
    const {row,score,g,r}=selected;
    const [contract,first,prior,current,priorRepeat,repeat,again,,,transactions,days,lastActive,lastDeployment,examples,methods]=row;
    return <>
      <a className="back" href={sort==='score'?'/deployments/':'/deployments/?sort='+sort} onClick={event=>openContract(event,'')}>← Deployment directory</a>
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
      <div className="columns">
        <section className="panel"><h2>What changed?</h2>
          <p>{fmt(repeat)} signers appeared in both recent windows, compared with {fmt(priorRepeat)} across the earlier pair. That is a change of {repeat-priorRepeat>=0?'+':''}{fmt(repeat-priorRepeat)} repeat signers.</p>
          <p>{fmt(transactions)} distinct direct call attempts across {fmt(days)} of the latest 28 days. {lastActive?`Last observed call: ${lastActive} UTC.`:''}</p>
          <p>{lastDeployment?`Last direct deployment or code attachment action in this snapshot: ${lastDeployment} UTC.`:'No direct deployment or code attachment action was observed in these 84 days.'}</p>
          {examples.length>0&&<p>{examples.map((tx,i)=><a className="tx-example" key={tx} href={'https://nearblocks.io/txns/'+tx}>Recent transaction {i+1} ↗</a>)}</p>}
        </section>
        <section className="panel"><h2>What repeat signers called</h2>
          <p>Methods called in the middle window by signers who also appeared in the first window.</p>
          {methods.length?<ul className="method-list">{methods.map(([method,tx,signers,example])=><li key={method}><code>{method}</code><span>{fmt(signers)} signers · {fmt(tx)} tx</span><a href={'https://nearblocks.io/txns/'+example}>Example ↗</a></li>)}</ul>:<p>No decoded method evidence for that cohort.</p>}
        </section>
      </div>
      <p className="atlas-source">Counts measure signer accounts and direct call attempts, including failures. A contract account may represent a service, token, or shared relayer. <a href="https://github.com/near/near-public-lakehouse">NEAR Public Lakehouse ↗</a></p>
    </>;
  }
  const visible=filtered.slice(page*pageSize,(page+1)*pageSize);
  return <>
    <section className="directory-lead">
      <div>
        <h1>Explore NEAR contracts</h1>
        <p>Find a contract and see which signers came back, what they called, and the transactions behind it.</p>
      </div>
      <div className="directory-scope">
        <strong>{fmt(scored.length)}</strong>
        <span>contract accounts in the snapshot</span>
        <small>{dates}</small>
      </div>
    </section>
    <div className="atlas-controls">
      <label className="search-control"><span className="sr-only">Find a contract</span><input placeholder="Search contract or project name" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>
      <label className="select-control"><span>Rank by</span><select value={sort} onChange={e=>{setSort(e.target.value);setPage(0);}}><option value="score">Discovery score</option><option value="repeat">Repeat signer gain</option><option value="signers">Active signers</option><option value="growth">28-day growth</option></select><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></label>
    </div>
    {visible.length ? <ul className="contract-grid">
      {visible.map(({row, score}) => {
        const [contract,,,, earlier, later] = row;
        const name = names.get(contract);
        const gain = later - earlier;
        return <li key={contract}>
          <a className="contract-card" href={'/deployments/?contract='+encodeURIComponent(contract)} onClick={event=>openContract(event,contract)}>
            <div className="contract-card-title">
              <div><h2>{name ?? contract}</h2>{name && <p>{contract}</p>}</div>
              <span aria-hidden="true">↗</span>
            </div>
            <dl>
              <div><dt>Repeat signer gain</dt><dd className={gain > 0 ? 'contract-gain' : undefined}>{gain > 0 ? '+' : ''}{fmt(gain)}</dd></div>
              <div><dt>Active signers</dt><dd>{fmt(row[3])}</dd></div>
              <div><dt>Score</dt><dd>{score ?? '—'}</dd></div>
            </dl>
          </a>
        </li>;
      })}
    </ul> : <p className="blank">No contracts match your search.</p>}
    <div className="atlas-pagination"><button disabled={page===0} onClick={()=>setPage(page-1)}>Previous</button><span>{filtered.length?fmt(page*pageSize+1)+'–'+fmt(Math.min(filtered.length,(page+1)*pageSize)):'0'} of {fmt(filtered.length)}</span><button disabled={(page+1)*pageSize>=filtered.length} onClick={()=>setPage(page+1)}>Next</button></div>
    <p className="atlas-source">Coverage is limited to direct activity in this window. Ranking requires 50 signers in each recent 28-day window and 10 in the earlier 7-day window. Benchmarks and service accounts are included at contract level. <a href="https://github.com/near/near-public-lakehouse">Source ↗</a></p>
  </>;
}
