'use client';
import {LoadingPanel} from './brand-motion';

import {useEffect, useState} from 'react';
import projects from '../data/projects.json';
import cohortData from '../data/project-evidence.json';
import recentMainnet from '../data/recent-mainnet.json';
import {dateAt} from '../lib/model.mjs';
import {ResearchChart} from './research-graphics';

type Cohort = {signers:number[]; repeat:number; returned:number; methods:[string,number][]; examples:string[]};
type CohortRun = {end:string; projects:Record<string,Cohort|{unavailable:string}>};
const cohorts = cohortData as CohortRun | null;
const fmt = (value:number) => value.toLocaleString('en-US');
const rate = (n:number,d:number) => d ? Math.round(100*n/d)+'%' : '—';
const sixHours=6*60*60*1000;
type Block = {block_height:string; block_hash:string; block_timestamp:string; transactions_agg:{count:number}};
type Call = {transaction_hash:string; signer_account_id:string; block_timestamp:string; receiver_account_id:string; actions?:{method?:string}[]; outcomes?:{status?:boolean}};

export function LiveActivity({contract}:{contract?:string}) {
  const [blocks,setBlocks] = useState<Block[]>([]);
  const [calls,setCalls] = useState<Call[]>([]);
  const [updated,setUpdated] = useState('');
  const [failed,setFailed] = useState(false);
  const [loaded,setLoaded] = useState(false);

  useEffect(() => {
    let stopped = false;
    let controller:AbortController|undefined;
    async function refresh() {
      if (document.hidden || controller) return;
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const path = contract ? '/api/activity?dataset=contract&contract='+encodeURIComponent(contract) : '/activity/blocks.json';
        const response = await fetch(path,{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
        if (!response.ok) throw new Error('Feed unavailable');
        const {data,checkedAt}=await response.json();
        if (!Array.isArray(data)) throw new Error('Unexpected feed response');
        if (stopped || signal.aborted) return;
        if (contract) setCalls(data.filter((tx:Call)=>tx.receiver_account_id===contract).slice(0,5));
        else {
          const valid = data.filter((block:Block) => Number.isFinite(block.transactions_agg?.count) && /^\d{19}$/.test(block.block_timestamp));
          if (!valid.length) throw new Error('No valid blocks returned');
          setBlocks(valid.sort((a:Block,b:Block) => Number(a.block_height)-Number(b.block_height)));
        }
        setUpdated(typeof checkedAt==='string' ? new Date(checkedAt).toLocaleString() : '');
        setFailed(false);
        setLoaded(true);
      } catch {
        if (!stopped && !signal.aborted) {
          if (!contract) setBlocks(previous=>previous.length ? previous : [...recentMainnet.data].reverse());
          setFailed(true);
        }
      } finally {
        controller = undefined;
      }
    }
    void refresh();
    const interval = window.setInterval(refresh,sixHours);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(interval);
    };
  },[contract]);

  const latest = blocks.at(-1);
  if (!failed && !loaded && !latest) return <div className="iv-block-placeholder"><LoadingPanel title={contract ? 'Recent Contract Transactions' : 'Mainnet Block Activity'} description="Loading the latest saved sample…"/></div>;
  return <section className="panel live-panel">
    <div className="section-title"><h2>{contract?'Recent Contract Transactions':'Mainnet Block Activity'}</h2><span className="live-state">{failed?(updated?'Update failed · last checked '+updated:'Feed unavailable'):updated?'Sampled '+updated:loaded?'Sample available':'Saved sample'}</span></div>
    {contract ? calls.length>0 ? <ul className="call-list">{calls.map(tx=><li key={tx.transaction_hash}><span>{tx.actions?.find(a=>a.method)?.method??'Transaction'}</span><span>{tx.outcomes?.status===true?'Succeeded':tx.outcomes?.status===false?'Failed':'Status unknown'}</span><a href={'https://nearblocks.io/txns/'+tx.transaction_hash}>View transaction ↗</a></li>)}</ul>
      : <p>{failed?'The saved activity sample is unavailable.':'No incoming transactions in the latest results.'}</p>
      : latest ? <><div className="live-summary"><a href={'https://nearblocks.io/blocks/'+latest.block_hash}>{fmt(Number(latest.block_height))}</a><span>{updated?'Latest indexed block':'Saved block sample'} · {new Date(Number(BigInt(latest.block_timestamp)/1000000n)).toISOString().slice(0,19).replace('T',' ')} UTC</span></div>
        <ResearchChart values={blocks.map(block=>block.transactions_agg.count)} days={blocks.map(block=>'Block '+block.block_height)} label="Transactions per recent mainnet block" bars/>
        <p>Transactions per block · {blocks.length} indexed blocks</p></>
      : <p>{failed?'The saved activity sample is unavailable.':'Loading recent blocks…'}</p>}
    <p className="source-line"><a href="https://api.nearblocks.io/api-docs/">NearBlocks</a> · {contract ? 'Contracts sampled in rotation' : 'Samples updated every six hours'}</p>
  </section>;
}

export function CohortEvidence({projectId}:{projectId?:string}) {
  if (!cohorts) return null;
  const complete = Object.entries(cohorts.projects).flatMap(([id,value])=>'signers' in value?[{id,...value}]:[])
    .sort((a,b)=>b.repeat-a.repeat);
  const end = cohorts.end;
  const value = projectId ? cohorts.projects[projectId] : undefined;
  if (projectId && !value) return null;
  if (projectId && value && 'unavailable' in value) return <section className="panel"><h2>Repeat signer history</h2><p>{value.unavailable}. This deployment is outside the verified cohort.</p></section>;
  const project = value && 'signers' in value ? value : null;
  return <section className="panel cohort-panel">
    <div className="section-title"><h2>{project?'Repeat signer history':'Repeat signers across three windows'}</h2></div>
    <p>{dateAt(end,-84)} to {dateAt(end,-1)} UTC · three 28-day windows · {complete.length} of {Object.keys(cohorts.projects).length} eligible deployments covered</p>
    {project ? <>
      <div className="cohort-steps">
        <div><span>First window</span><strong>{fmt(project.signers[0])}</strong><small>Active signers</small></div>
        <div><span>Second window</span><strong>{fmt(project.repeat)}</strong><small>Returned from the first window</small></div>
        <div><span>Third window</span><strong>{fmt(project.returned)}</strong><small>Returned again · {rate(project.returned,project.repeat)}</small></div>
      </div>
      <h3>Actions by returning signers</h3>
      <ul className="method-list">{project.methods.map(([name,count])=><li key={name}><code>{name}</code><span>{fmt(count)} transactions</span></li>)}</ul>
      {project.examples.length>0&&<p>{project.examples.map((hash,index)=><a key={hash} className="tx-example" href={'https://nearblocks.io/txns/'+hash}>Example {index+1} ↗</a>)}</p>}
    </>: complete.length ? <div className="cohort-ranking">{complete.map(row=><a key={row.id} href={'/app/project/'+row.id+'/?data=observed'}><strong>{projects.find(p=>p.id===row.id)?.name}</strong><span>{fmt(row.repeat)} repeated</span><span>{fmt(row.returned)} returned again</span></a>)}</div>:<p>Historical coverage is incomplete for this cohort.</p>}
    <p className="source-line">NearBlocks · successful direct function calls, excluding methods prefixed with <code>epoch_</code>. Shared signers and relayers can affect these counts.</p>
  </section>;
}
