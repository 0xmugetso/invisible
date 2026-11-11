'use client';

import {useEffect, useState} from 'react';

const metrics:Record<string,string> = {
  current_signers:'Current 28-day signers', prior_signers:'Previous 28-day signers',
  prior_weekly_signers:'Previous weekly signers', repeat_signers:'Returning signers', active_days:'Active days',
};
const status:Record<string,string> = {
  reference:'Reference project', below_ranking_thresholds:'Below activity thresholds',
  awaiting_measurement:'Waiting for mapped activity', awaiting_comparable_cohort:'Waiting for a comparable cohort',
};
const num = new Intl.NumberFormat('en-US');
const money = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2});
const format = (value:number|null|undefined) => value == null ? '—' : num.format(value);
const percent = (value:number|null|undefined) => value == null ? '—' : (value > 0 ? '+' : '')+Math.round(value*100)+'%';

type Project = {
  id:string; name:string; status:string; activityRank:number|null; activityScore:number|null;
  tokens:{symbol:string; accountId:string; evidence:string}[];
  activity:{current_signers:number; repeat_signers:number; monthly_growth:number|null; evidence:string[]} | null;
  unmetThresholds:{metric:string; minimum:number; observed:number|null}[];
};
type Board = {cutoff:string|null; coverage:{catalogEntries:number;reviewPending:number}; projects:Project[]};
type Sourced = {source:string; summary?:string; status?:string; [key:string]:unknown};
type Market = {
  status:string; source:string; checkedAt?:string; marketCapRank?:number|null; marketCapRankSource?:{url:string}|null;
  marketCapUsd?:string|null; fullyDilutedValuationUsd?:string|null; circulatingSupply?:string|null; totalSupplyOnNear?:string|null;
};
type Dossier = {
  tokens:(Project['tokens'][number] & {market:Market})[];
  contracts:Record<string,string>;
  tokenomics:Record<string,Sourced|null>;
  roadmap:Sourced|null; socialActivity:Sourced|null; narrativeMomentum:Sourced|null;
};
const evidenceNames:Record<string,string> = {
  stage:'Token stage', vesting:'Vesting', upcomingUnlocks:'Upcoming unlocks',
  burns:'Burns', buybacks:'Buybacks', roadmap:'Roadmap', social:'Social activity', narrative:'Market narrative',
};
const evidenceFields:Record<string,string> = {
  teamAllocationPercent:'Team allocation (%)', teamAndAdvisorsAllocationPercent:'Team and advisors allocation (%)',
  cliffMonths:'Cliff (months)', vestingMonths:'Vesting (months)', linearVestingMonths:'Linear vesting (months)',
  unlockedAtLaunchPercent:'Unlocked at launch (%)', reservePercent:'Reserve (%)', launchBurnPercent:'Launch burn (%)',
};
async function getResearch<T>(params:Record<string,string>, signal:AbortSignal):Promise<T> {
  const response = await fetch('/api/research?'+new URLSearchParams(params),{signal});
  if (!response.ok) throw new Error('Research data unavailable');
  return response.json();
}

function ProjectEvidence({project}:{project:Project}) {
  const [data,setData] = useState<Dossier|null>(null);
  const [failed,setFailed] = useState(false);
  useEffect(()=>{
    const controller = new AbortController();
    getResearch<Dossier>({view:'project',id:project.id},controller.signal).then(setData).catch(()=>{
      if (!controller.signal.aborted) setFailed(true);
    });
    return ()=>controller.abort();
  },[project.id]);
  return <div className="research-evidence">
    {project.activity && <p>28-day activity · {format(project.activity.current_signers)} signers · {format(project.activity.repeat_signers)} returning · {percent(project.activity.monthly_growth)} vs prior window</p>}
    {project.unmetThresholds.length > 0 && <p>{project.unmetThresholds.map(({metric,observed,minimum})=>
      `${metrics[metric] ?? metric} ${format(observed)} (minimum ${minimum})`).join(' · ')}</p>}
    {project.activity?.evidence[0] && <p><a href={'https://nearblocks.io/txns/'+project.activity.evidence[0]}>View example transaction</a></p>}
    {data ? <>
      {data.tokens.map(({accountId,symbol,evidence,market})=><div key={accountId}>
        <p><a href={evidence}>{symbol} token contract</a> · <a href={market.source}>Market data source</a>{market.checkedAt && <> · Checked {market.checkedAt.slice(0,10)} UTC</>}</p>
        {market.status==='reported' ? <dl className="research-metrics">
          <div><dt>Market cap</dt><dd>{market.marketCapUsd == null ? '—' : money.format(Number(market.marketCapUsd))}</dd></div>
          <div><dt>FDV</dt><dd>{market.fullyDilutedValuationUsd == null ? '—' : money.format(Number(market.fullyDilutedValuationUsd))}</dd></div>
          <div><dt>Circulating supply</dt><dd>{market.circulatingSupply == null ? '—' : format(Number(market.circulatingSupply))}</dd></div>
          <div><dt>Supply on NEAR</dt><dd>{market.totalSupplyOnNear == null ? '—' : format(Number(market.totalSupplyOnNear))}</dd></div>
          <div><dt>Market cap rank</dt><dd>{market.marketCapRankSource && market.marketCapRank != null ? <a href={market.marketCapRankSource.url}>{format(market.marketCapRank)}</a> : '—'}</dd></div>
        </dl> : <p>Market data unavailable.</p>}
      </div>)}
      <dl className="research-notes">{Object.entries(evidenceNames).map(([key,label])=>{
        const item = key==='roadmap' ? data.roadmap : key==='social' ? data.socialActivity : key==='narrative' ? data.narrativeMomentum : data.tokenomics[key];
        const terms = item ? Object.entries(evidenceFields).flatMap(([field,title])=>typeof item[field]==='number' ? [`${title} ${item[field]}`] : []) : [];
        return <div key={key}><dt>{label}</dt><dd>{item ? <>
          {item.summary || terms.join(' · ') || item.status?.replaceAll('_',' ')} <a href={item.source}>Source</a>
        </> : 'Evidence pending'}</dd></div>;
      })}</dl>
      {!!Object.keys(data.contracts).length && <p>Mapped contracts · {Object.entries(data.contracts).map(([account,source])=><a key={account} href={source}>{account} </a>)}</p>}
    </> : <p role="status">{failed ? 'Project evidence is temporarily unavailable.' : 'Loading project evidence…'}</p>}
  </div>;
}

export default function ActivityRankings() {
  const [board,setBoard] = useState<Board|null>(null);
  const [failed,setFailed] = useState(false);
  const [showUnranked,setShowUnranked] = useState(false);
  const [expanded,setExpanded] = useState<string|null>(null);
  useEffect(()=>{
    const controller = new AbortController();
    const load = ()=>getResearch<Board>({view:'leaderboard'},controller.signal).then(result=>{
      setBoard(result); setFailed(false);
    }).catch(()=>{if (!controller.signal.aborted) setFailed(true);});
    void load();
    const interval = window.setInterval(load,60000);
    return ()=>{controller.abort();window.clearInterval(interval);};
  },[]);
  if (!board) return <p className="research-loading" role="status">{failed ? 'Rankings are temporarily unavailable. This page retries every minute.' : 'Loading verified projects…'}</p>;
  const ranked = board.projects.filter(project=>project.activityRank!==null);
  const unranked = board.projects.filter(project=>project.activityRank===null);
  const projects = showUnranked ? unranked : ranked;
  return <section className="research-ranking" aria-label="Project rankings">
    <div className="ranking-tools">
      <div className="ranking-switch" aria-label="Ranking status">
        <button type="button" aria-pressed={!showUnranked} onClick={()=>setShowUnranked(false)}>Ranked ({ranked.length})</button>
        <button type="button" aria-pressed={showUnranked} onClick={()=>setShowUnranked(true)}>Unranked ({unranked.length})</button>
      </div>
      <p>{board.cutoff ? `Activity through ${board.cutoff.slice(0,10)} UTC (exclusive)` : 'Activity snapshot pending'}{failed ? ' · Last available snapshot' : ''}</p>
    </div>
    {projects.length ? <div className="research-table-scroll"><table>
      <thead><tr><th scope="col">Rank</th><th scope="col">Project</th><th scope="col">28d signers</th><th scope="col">Returning</th><th scope="col">28d change</th><th scope="col">Activity score</th></tr></thead>
      {projects.map(project=><tbody key={project.id}>
        <tr><td>{project.activityRank ?? '—'}</td>
          <th scope="row"><button type="button" aria-expanded={expanded===project.id} aria-controls={'research-'+project.id}
            onClick={()=>setExpanded(expanded===project.id ? null : project.id)}>{project.name}</button>
            <small>{project.tokens.map(token=>token.symbol).join(', ')}{project.activityRank===null && <> · {status[project.status] ?? project.status}</>}</small></th>
          <td>{format(project.activity?.current_signers)}</td><td>{format(project.activity?.repeat_signers)}</td>
          <td>{percent(project.activity?.monthly_growth)}</td><td>{format(project.activityScore)}</td>
        </tr>
        <tr id={'research-'+project.id} hidden={expanded!==project.id}><td colSpan={6}>{expanded===project.id && <ProjectEvidence project={project}/>}</td></tr>
      </tbody>)}
    </table></div> : <p className="ranking-empty">No projects in this view.</p>}
    <p className="research-coverage">{board.coverage.catalogEntries} ecosystem listings · {board.coverage.reviewPending} awaiting review <a href="#project-registry">Browse coverage</a></p>
  </section>;
}
