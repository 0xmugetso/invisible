'use client';

import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import Link from 'next/link';
import Icon from './interface-icon';
import EvidenceDialog from './evidence-dialog';
import {getResearch,type ResearchProject,type ResearchBoard} from './use-research-board';

const metrics:Record<string,string> = {
  current_signers:'Current 28-day signers', prior_signers:'Previous 28-day signers',
  prior_weekly_signers:'Previous weekly signers', repeat_signers:'Returning Signers', active_days:'Active days',
};
const num = new Intl.NumberFormat('en-US');
const money = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2});
const format = (value:number|null|undefined) => value == null ? '—' : num.format(value);
const percent = (value:number|null|undefined) => value == null ? '—' : (value > 0 ? '+' : '')+Math.round(value*100)+'%';

type Sourced = {source:string; summary?:string; status?:string; [key:string]:unknown};
type Market = {
  status:string; source:string; tokenName?:string|null; checkedAt?:string; marketCapRank?:number|null; marketCapRankSource?:{url:string}|null;
  nearSupplySource?:string|null; marketCapUsd?:string|null; fullyDilutedValuationUsd?:string|null; circulatingSupply?:string|null; totalSupplyOnNear?:string|null;
};
type Dossier = Pick<ResearchProject,'name'|'activityScore'|'scoreComponents'|'unmetThresholds'> & {
  tokens:ResearchProject['tokens'];
  weights?:ResearchBoard['weights'];
  contracts:Record<string,string>;
  measurement?:string|null;
  cutoff?:string|null;
  description?:string;
  benchmark?:boolean;
  activity:(NonNullable<ResearchProject['activity']> & {contracts?:string[]})|null;
  contractActivity?:{account:string;current_signers:number;prior_signers:number;repeat_signers:number;example_transaction:string|null}[]|null;
  links?:Record<string,string|{url:string;evidence:string}>;
  tokenomics:Record<string,Sourced|null>;
  roadmap:Sourced|null;
};
export const activityScoreLabels:Record<string,string> = {
  adjusted_return:'Return Rate', repeat_signers:'Returning Signers', adjusted_growth:'Signer Growth', spread:'Activity Spread',
};
const contributions = [
  {key:'adjusted_return',icon:'repeat',note:'How often prior signers came back'},
  {key:'repeat_signers',icon:'users',note:'Signers seen in both windows'},
  {key:'adjusted_growth',icon:'growth',note:'Change in 28-day signers'},
  {key:'spread',icon:'observed',note:'How evenly activity was distributed'},
] as const;

function EvidenceLink({href,children}:{href:string; children:string}) {
  return <a href={href} target="_blank" rel="noreferrer">{children} <Icon name="launch"/></a>;
}

const socialMarks = {X:'x',Discord:'discord',Telegram:'telegram-white',github:'github'} as const;

function ProjectChannels({links}:{links:Dossier['links']}) {
  if (!links) return null;
  return <div className="iv-project-channels" aria-label="Project links">
    {links.website && <a href={typeof links.website==='string' ? links.website : links.website.url} aria-label="Website" title="Website" target="_blank" rel="noreferrer"><Icon name="globe"/></a>}
    {Object.entries(socialMarks).map(([platform,icon])=>{
      const entry=links[platform];
      if (!entry) return null;
      const label=platform==='github' ? 'GitHub' : platform;
      return <a key={platform} href={typeof entry==='string' ? entry : entry.url} aria-label={label} title={label} target="_blank" rel="noreferrer">
        <img src={'/marks/social/'+icon+'.svg'} alt="" width="17" height="17"/>
      </a>;
    })}
  </div>;
}

function Vesting({evidence}:{evidence:Sourced|null}) {
  const team = evidence?.teamAndAdvisorsAllocationPercent ?? evidence?.teamAllocationPercent;
  const duration = evidence?.linearVestingMonths ?? evidence?.vestingMonths;
  const label = evidence?.teamAndAdvisorsAllocationPercent != null ? 'Team and advisers' : 'Team';
  const cliff = evidence?.cliffMonths;
  const atLaunch = evidence?.unlockedAtLaunchPercent;
  const hasShare = typeof team==='number' && team>0 && team<=100;
  const terms=[
    {label:'Unlocked at launch',value:typeof atLaunch==='number' ? `${atLaunch}%` : null,note:'Share of the allocation available at launch'},
    {label:'Cliff',value:typeof cliff==='number' ? `${cliff} months` : null,note:'Initial waiting period'},
    {label:'Vesting period',value:typeof duration==='number' ? `${duration} months` : null,note:evidence?.linearVestingMonths!=null ? 'Released gradually on a linear schedule' : 'Release period in the published terms'},
  ].filter(term=>term.value!==null);
  return <div className="iv-vesting">
    <div className="iv-vesting-head"><h4><Icon name="clock"/> Vesting Terms</h4>{evidence && <EvidenceLink href={evidence.source}>Published terms</EvidenceLink>}</div>
    {hasShare && <div className="iv-vesting-allocation">
      <div className="iv-vesting-ring" aria-hidden="true" style={{background:`conic-gradient(var(--iv-pink) 0 ${team}%, var(--iv-line) ${team}% 100%)`}}><strong>{team}%</strong></div>
      <div><strong>{label} allocation</strong><p>{team}% of total supply</p></div>
    </div>}
    {terms.length>0 && <dl className="iv-vesting-terms">{terms.map(({label,value,note})=><div key={label}>
      <dt>{label}</dt><dd>{value}</dd><small>{note}</small>
    </div>)}</dl>}
    {evidence?.summary && <p>{evidence.summary}</p>}
    {!evidence && <p className="iv-evidence-muted">Verified vesting terms unavailable</p>}
  </div>;

}

function Tokenomics({data}:{data:Dossier}) {
  const {stage,vesting,upcomingUnlocks,burns,buybacks}=data.tokenomics;
  return <section className="iv-dossier-section iv-tokenomics" aria-label="Tokenomics and unlocks">
    <div className="iv-dossier-title"><h3><Icon name="contracts"/> Tokenomics &amp; Unlocks</h3>{stage?.summary && <p>{stage.summary}</p>}</div>
    <div className="iv-tokenomics-grid">
      <Vesting evidence={vesting}/>
      <div className="iv-unlocks">
        <h4><Icon name="unlock"/> Upcoming Unlocks</h4>
        <p>{upcomingUnlocks?.summary ?? 'No verified upcoming unlock date'}</p>
        {typeof upcomingUnlocks?.reservePercent==='number' && <p className="iv-evidence-muted">{upcomingUnlocks.reservePercent}% reserved for milestones</p>}
        {upcomingUnlocks && <EvidenceLink href={upcomingUnlocks.source}>Unlock terms</EvidenceLink>}
      </div>
    </div>
    {[{evidence:burns,label:'Burns'},{evidence:buybacks,label:'Buybacks'}].some(item=>item.evidence) &&
      <div className="iv-token-actions">{[{evidence:burns,label:'Burns'},{evidence:buybacks,label:'Buybacks'}].map(({evidence,label})=>evidence &&
        <div key={label}><h4>{label}</h4><p>{evidence.summary ?? (typeof evidence.launchBurnPercent==='number' ? evidence.launchBurnPercent+'% burned at launch' : 'Issuer reported')}</p><EvidenceLink href={evidence.source}>Source</EvidenceLink></div>)}</div>}
    {stage && stage.source!==vesting?.source && stage.source!==upcomingUnlocks?.source && <div className="iv-dialog-links"><EvidenceLink href={stage.source}>Tokenomics source</EvidenceLink></div>}
  </section>;
}

function ProjectEvidence({projectId,data,market:pools,quotes,weights}:{data:Dossier; market?:ResearchProject['market']; quotes:Record<string,Market>|null; projectId:string; weights?:ResearchBoard['weights']}) {
  const {activity,unmetThresholds:unmet,tokens}=data;
  const activityThrough = data?.cutoff && activity ? new Date(Date.parse(data.cutoff)-1).toISOString().slice(0,10) : null;
  return <div className="research-evidence">
    {data.scoreComponents && weights && <section className="iv-dossier-section">
      <div className="iv-dossier-title"><h3><Icon name="ranking"/> Activity Score Contributions</h3>{data.activityScore!=null && <small>{data.activityScore} / 100 overall</small>}</div>
      <div className="iv-score-cards">{contributions.flatMap(({key,note,icon})=>{
        const value=data.scoreComponents?.[key];
        const weight=weights[key];
        if (value==null || !Number.isFinite(weight)) return [];
        return [<article key={key} className="iv-score-contribution">
          <h4><Icon name={icon}/> {activityScoreLabels[key]}</h4><p><strong>{(value*weight*100).toFixed(1)}</strong><span> / {Math.round(weight*100)}</span></p>
          <div className="iv-score-track" aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,value*100))}%`}}/></div>
          <small>{note}</small>
        </article>];
      })}</div>
    </section>}
    {!tokens.length && data.description && <p>{data.description}</p>}
    {tokens.length>0 && <Tokenomics data={data}/>}
    {tokens.map(({accountId,symbol,evidence})=>{
      const market=quotes?.[accountId];
      const pool=tokens.length===1 ? pools : null;
      const unavailable=quotes===null ? 'Loading' : '—';
      const marketCap=market?.marketCapUsd ?? pool?.marketCapUsd;
      const fdv=market?.fullyDilutedValuationUsd ?? pool?.fdvUsd;
      return <section className="iv-dossier-section iv-market-section" key={accountId}>
        <div className="iv-dossier-title"><h3><Icon name="growth"/> {symbol} Market Data</h3>
          <small role="status">{quotes===null ? 'Fetching market figures…' : market?.checkedAt && market.status==='reported' ? `Retrieved ${market.checkedAt.slice(0,10)} UTC` : 'Market feed unavailable'}</small>
        </div>
        <div className="iv-market-ledger">
          <div><h4>Valuation</h4><dl>
            <div><dt>Market cap</dt><dd>{marketCap == null ? unavailable : money.format(Number(marketCap))}</dd></div>
            <div><dt>FDV</dt><dd>{fdv == null ? unavailable : money.format(Number(fdv))}</dd></div>
            <div><dt>Market cap rank</dt><dd>{market?.marketCapRank == null ? unavailable : '#'+format(market.marketCapRank)}</dd></div>
            {pool && <div><dt>Largest pool reserves</dt><dd>{money.format(pool.liquidityUsd)}</dd></div>}
          </dl></div>
          <div><h4>Supply</h4><dl>
            <div><dt>Circulating supply</dt><dd>{market?.circulatingSupply == null ? unavailable : format(Number(market.circulatingSupply))}</dd></div>
            <div><dt>Total supply on NEAR</dt><dd>{market?.totalSupplyOnNear == null ? unavailable : format(Number(market.totalSupplyOnNear))}</dd></div>
          </dl></div>
        </div>
        <div className="iv-dialog-links">
          <EvidenceLink href={evidence}>Token contract</EvidenceLink>
          {market?.status==='reported' && <EvidenceLink href={market.source}>Market source</EvidenceLink>}
          {pool && <EvidenceLink href={pool.source}>Pool source</EvidenceLink>}
          {market?.nearSupplySource && market.nearSupplySource!==market.source && <EvidenceLink href={market.nearSupplySource}>Supply source</EvidenceLink>}
        </div>
      </section>;
    })}
    <section className="iv-dossier-section" aria-label="On-Chain Activity">
      <div className="iv-dossier-title"><h3><Icon name="observed"/> On-Chain Activity</h3>{activityThrough && <small>Through {activityThrough} UTC</small>}</div>
      {activity ? <dl className="iv-market-grid iv-signer-grid">
        <div><dt>Latest 28-day signers</dt><dd>{format(activity.current_signers)}</dd></div>
        <div><dt>Previous 28-day signers</dt><dd>{format(activity.prior_signers)}</dd></div>
        <div><dt>Returning Signers</dt><dd>{format(activity.repeat_signers)}</dd></div>
        <div><dt>Signer Growth</dt><dd>{percent(activity.monthly_growth)}</dd></div>
      </dl> : <p className="iv-evidence-muted">{data.measurement ?? (data.benchmark ? 'Tracked as a benchmark.' : 'Comparable 28-day activity is unavailable')}</p>}
    </section>
    {data && <details className="iv-dossier-details">
      <summary><Icon name="research"/> Contracts &amp; research sources</summary>
      <div className="iv-dossier-source-body">
        <Link href={'/app/deployments/?project='+encodeURIComponent(projectId)}>Open project deployment evidence <Icon name="launch"/></Link>
        {activity && data.measurement && <p>{data.measurement}</p>}
        {data.activity?.contracts && data.activity.contracts.length!==Object.keys(data.contracts).length &&
          <p>The snapshot used {data.activity.contracts.length} of the currently mapped contracts.</p>}
        {Object.keys(data.contracts).length>0 && <ul className="iv-dialog-accounts iv-contract-evidence">{Object.entries(data.contracts).map(([account,source])=>{
          const observed=data.contractActivity?.find(entry=>entry.account===account);
          return <li key={account}>
            <div><Link href={'/app/deployments/?contract='+encodeURIComponent(account)}>{account}</Link>
              {observed && <small>{format(observed.current_signers)} latest · {format(observed.prior_signers)} prior · {format(observed.repeat_signers)} returning</small>}
            </div>
            <span><EvidenceLink href={source}>Attribution</EvidenceLink>
              {observed?.example_transaction && <EvidenceLink href={'https://nearblocks.io/txns/'+observed.example_transaction}>Example call</EvidenceLink>}
            </span>
          </li>;
        })}</ul>}
        {activity?.evidence[0] && <div className="iv-dialog-links"><EvidenceLink href={'https://nearblocks.io/txns/'+activity.evidence[0]}>Latest example transaction</EvidenceLink></div>}
        {unmet.length>0 && <dl className="iv-dialog-data">{unmet.map(({metric,observed,minimum})=><div key={metric}><dt>{metrics[metric] ?? metric}</dt><dd>{format(observed)} / {format(minimum)} required</dd></div>)}</dl>}
        {data.roadmap && <p>{data.roadmap.summary} <EvidenceLink href={data.roadmap.source}>Roadmap</EvidenceLink></p>}
        {data.links && <div className="iv-dialog-links">{Object.entries(data.links).filter(([label])=>label!=='website' && !Object.hasOwn(socialMarks,label)).map(([label,entry])=>
          <EvidenceLink key={label} href={typeof entry==='string' ? entry : entry.url}>{({website:'Website',documentation:'Documentation',github:'GitHub'} as Record<string,string>)[label] ?? label}</EvidenceLink>)}</div>}
      </div>
    </details>}
  </div>;
}

export function ProjectEvidenceDialog({projectId,market,weights,onDismiss}:{
  projectId:string; market?:ResearchProject['market']; weights?:ResearchBoard['weights']; onDismiss:()=>void;
}) {
  const [data,setData]=useState<Dossier|null>(null);
  const [quotes,setQuotes]=useState<Record<string,Market>|null>(null);
  const [failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const trigger=useRef<HTMLElement|null>(null);
  useLayoutEffect(()=>{
    const active=document.activeElement;
    if (active instanceof HTMLElement) trigger.current=active;
    return ()=>{if (trigger.current?.isConnected) trigger.current.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    getResearch<Dossier>({view:'project-core',id:projectId},controller.signal).then(result=>{
      if (controller.signal.aborted) return;
      setData(result);
      if (!result.tokens.length) return;
      getResearch<{tokens:{accountId:string; market:Market}[]}>({view:'project-market',id:projectId},controller.signal).then(({tokens})=>{
        if (!controller.signal.aborted) setQuotes(Object.fromEntries(tokens.map(token=>[token.accountId,token.market])));
      }).catch(()=>{
        if (!controller.signal.aborted) setQuotes({});
      });
    }).catch(()=>{
      if (!controller.signal.aborted) setFailed(true);
    });
    return ()=>controller.abort();
  },[projectId,attempt]);
  if (!data) return <div className="iv-evidence-loading" onKeyDown={event=>{if(event.key==='Escape')onDismiss();}}>
    <div role="status">{!failed && <i aria-hidden="true"/>}{failed ? 'Project evidence is temporarily unavailable' : 'Loading project evidence…'}</div>
    {failed && <button type="button" className="iv-outline" onClick={()=>{setFailed(false);setAttempt(attempt+1);}}>Retry</button>}
    <button type="button" className="iv-outline" onClick={onDismiss}>Cancel</button>
  </div>;
  const subtitle=data.tokens.map(({symbol,accountId})=>{
    const name=quotes?.[accountId]?.tokenName;
    return name && name.toLowerCase()!==symbol.toLowerCase() ? `${name} (${symbol})` : symbol;
  }).join(' · ');
  return <EvidenceDialog projectId={projectId} title={data.name}
    subtitle={subtitle || 'Project coverage'} returnFocus={trigger.current} actions={<ProjectChannels links={data.links}/>} onDismiss={onDismiss}>
    <ProjectEvidence projectId={projectId} data={data} market={market} quotes={quotes} weights={data.weights ?? weights}/>
  </EvidenceDialog>;
}
