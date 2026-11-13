'use client';
import WorkspaceHeading from './workspace-heading';
import DataSkeleton from './data-skeleton';
import {Suspense,useEffect,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {ResearchChart, ReturningShare, CountUp} from './research-graphics';
import ActivityRankings from './activity-rankings';
import Icon from './interface-icon';
import ProjectMark from './project-mark';
import RankingWeights from './ranking-weights';
import ProjectCoverage from './project-coverage';
import DeploymentAtlas from './deployment-atlas';
import EcosystemStory from './ecosystem-story';
import projects from '../data/projects.json';
import observed from '../data/observed.json';
import {CohortEvidence, LiveActivity} from './onchain-evidence';
import SignerForecast from './signer-forecast';
import {rank, concentration, pct, change, dateAt} from '../lib/model.mjs';

import {summarizeDeployments, type DeploymentSummary} from './summarize-deployments';
import {useRankingRelease} from './use-ranking-release';
import type {Metric,Snapshot,Row} from '../lib/model.mjs';
const fmt=(n:number|null|undefined)=>n==null?'—':n.toLocaleString('en-US');
const warehouse='https://github.com/near/near-public-lakehouse#examples';
const marks:Record<string,string>={linear:'linear.jpg',metapool:'metapool.svg',social:'social.svg',ref:'ref.png',burrow:'ref.png',intents:'intents.png',aurora:'aurora.jpg',sweat:'sweat.svg',sputnik:'sputnik.jpg',wrap:'wrap.png'};
function Stat({label,value,note}:{label:string;value:string|number;note:string}){return <div className="stat"><div className="micro">{label}</div><strong><CountUp value={value}/></strong><small>{note}</small></div>;}
function Badge({r}:{r:Row}){
  if (['linear','metapool','aurora','sweat'].includes(r.id)) return <ProjectMark id={r.id}/>;
  return <span className={'badge badge-'+r.id}><img src={'/marks/'+marks[r.id]} alt="" width="32" height="32"/></span>;
}
function Signal({r}:{r:Row}){
  return <p className="signal-text">{change(r.g28)} over 28 days and {change(r.g7)} over 7 days. {fmt(r.m?.repeat)} previous-window signers returned ({pct(r.ret)}). {r.att==null?'Public attention is unmeasured.':`Attention changed ${change(r.att)} over 28 days.`}</p>;
}
type TerminalProps={view:string;id?:string;coverage?:DeploymentSummary};
export default function Terminal(props:TerminalProps) {
  return <Suspense fallback={<main id="main-content"><DataSkeleton variant="cards" label="Loading workspace"/></main>}><TerminalContent {...props}/></Suspense>;
}

function TerminalContent({view,id,coverage:initialCoverage}:TerminalProps){
  const dataset=useSearchParams().get('data');
  const useReal=view==='deployments' || (dataset!=='demo' && dataset!=='forecast');
  const release = useRankingRelease();
  const [ranking, setRanking] = useState<{snapshot:Snapshot; coverage:DeploymentSummary; report:string; deployments:string} | null>(null);
  useEffect(() => {
    if (!release || view === 'deployments' || !useReal) return;
    const controller = new AbortController();
    async function read(path: string) {
      const response = await fetch(path, {signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])});
      if (!response.ok) throw new Error('Ranking release unavailable');
      return response.json();
    }
    Promise.all([read(release.observed), read(release.deployments)]).then(([snapshot, contracts]) => {
      if (controller.signal.aborted || snapshot.kind !== 'observed' || snapshot.end !== contracts.end) return;
      setRanking({snapshot, coverage: summarizeDeployments(contracts), report: release.report, deployments: release.deployments});
    }).catch(() => {});
    return () => controller.abort();
  }, [release, view, useReal]);
  const coverage = ranking?.coverage ?? initialCoverage;
  const snap:Snapshot|null=ranking?.snapshot ?? observed;
  const params='?data=observed';
  function switchMode(v:boolean){
    const url=new URL(window.location.href);
    url.searchParams.set('data',v?'observed':'forecast');
    window.history.replaceState(null,'',url);
  }
  const {rows,mode,eligible}=rank(projects,snap);
  const signals=rows.filter(r=>r.signal),project=rows.find(r=>r.id===id);
  const recent=concentration(rows.flatMap(r=>r.m?.contracts.map((c:Metric['contracts'][number])=>c.tx)??[]));
  const prior=concentration(rows.flatMap(r=>r.m?.contracts.map((c:Metric['contracts'][number])=>c.prevTx)??[]));
  const history=project?.m?.daily??[];
  const dataMode=<div className="iv-switch" aria-label="Data mode">
    <button type="button" onClick={()=>switchMode(true)} aria-pressed={useReal}><Icon name="observed"/>Observed</button>
    <button type="button" onClick={()=>switchMode(false)} aria-pressed={!useReal}><Icon name="simulation"/>Forecast</button>
  </div>;
  return <div className="shell iv-terminal" data-view={view}>
    <div className="workspace">
    <main id="main-content">
      {!useReal ? <>
        <WorkspaceHeading title="28-Day Signer Forecast" description="Compare a cohort forecast with a flat baseline using measured NEAR activity." actions={dataMode}/>
        <SignerForecast projectId={id}/>
      </> : <>
      {view==='project' && <div className="iv-data-tools">{dataMode}</div>}
      {view==='deployments'&&<DeploymentAtlas snapshotPath={release?.deployments}/>}
      {view==='discovery'&&<>
          <section className="discovery-projects" aria-labelledby="project-rankings">
            <WorkspaceHeading id="project-rankings" title="NEAR Project Rankings"
              description="Compare verified-token projects by on-chain activity and market data. Open a project for the evidence behind its score." actions={dataMode}/>
            <ActivityRankings/>
          </section>
          <ProjectCoverage/>
      </>}
      {view==='project'&&project&&<>
        <Link className="back" href={'/app/discovery/'+params}>← Back to discovery</Link>
        <section className="detail-head iv-ready-fade"><div className="detail-name"><Badge r={project}/><h1>{project.name}</h1></div><p>{project.description}</p>{useReal&&<Link className="back" href={'/app/deployments/?contract='+encodeURIComponent(project.contracts[0])}>View three-window signer evidence ↗</Link>}</section>
        {useReal&&<><LiveActivity contract={project.contracts[0]}/><CohortEvidence projectId={project.id}/></>}
        <div className="stats"><Stat label={mode.toUpperCase()} value={project.score??'—'} note={project.benchmark?'Benchmark · excluded from ranking':`${eligible} eligible peers`}/><Stat label="ACTIVE SIGNERS / 28D" value={fmt(project.m?.a28)} note={`${change(project.g28)} vs previous 28 days`}/><Stat label="RETURNING / 28D" value={pct(project.ret)} note={`${fmt(project.m?.repeat)} of ${fmt(project.m?.b28)} previous signers`}/><Stat label="TRANSACTIONS / 28D" value={fmt(project.m?.tx)} note={`Previous: ${fmt(project.m?.prevTx)}`}/></div>
        <section className="panel"><div className="section-title"><h2>Daily active signers</h2><span className="micro">56 DAYS / UTC</span></div><ResearchChart values={history.map(d=>d.accounts)} days={history.map(d=>d.day)} label="Daily active signers, 56 days" stepped split/>{snap&&<div className="axis"><span>{dateAt(snap.end,-56)}</span><span>{dateAt(snap.end,-28)}</span><span>{dateAt(snap.end,-1)}</span></div>}</section>
        {project.m&&<ReturningShare prior={project.m.b28} current={project.m.a28} repeat={project.m.repeat}/>}
        <div className="columns"><section className="panel"><h2>{project.signal??'No qualified signal'}</h2>{project.m?<Signal r={project}/>:<p>No measured project metrics are available.</p>}<p>{project.signal?`${project.confidence} heuristic confidence. Repeat activity supports persistence across two windows; this does not establish a cause.`:'A signal requires ≥25% 28-day growth, positive 7-day growth, ≥25% returning signers and ≥25 net signers, after eligibility checks.'}</p><p>{project.risk}</p></section><section className="panel"><h2>Adoption vs. attention</h2><dl><dt>7-day change</dt><dd>{change(project.g7)}</dd><dt>28-day adoption change</dt><dd>{change(project.g28)}</dd><dt>28-day attention change</dt><dd>{project.att==null?'Unavailable':change(project.att)}</dd><dt>Default-branch commits, current / prior</dt><dd>{project.m?.commits?.join(' / ')??'Unavailable'}</dd>{project.components&&Object.entries(project.components).map(([k,v])=><div className="dl-row" key={k}><dt>{k} percentile</dt><dd>{v==null?'Excluded':Math.round(Number(v))}</dd></div>)}</dl><p>Effective weight denominator: {project.components?project.weight:'—'}. <Link href={'/docs/'+params}>Read the model ↗</Link></p></section></div>
        <section className="panel"><h2>Contracts and evidence</h2>{project.contracts.map((c:string)=><div className="evidence" key={c}><a href={'https://nearblocks.io/address/'+c}>{c} ↗</a><span>{fmt(project.m?.contracts.find((x:Metric['contracts'][number])=>x.contract===c)?.tx)} tx / 28d</span></div>)}<p><a href={project.source}>Attribution source ↗</a> &nbsp; <a href={warehouse}>Warehouse schema ↗</a>{project.repo&&<> &nbsp; <a href={'https://github.com/'+project.repo+'/commits'}>Repository commits ↗</a></>}</p><p>{snap?.provenance??'No export run loaded.'}</p></section>
      </>}
      {view==='ecosystem' && (snap
        ? <EcosystemStory rows={rows} snapshot={snap} params={params} modeControl={dataMode}/>
        : <><WorkspaceHeading title="NEAR Ecosystem Activity" actions={dataMode}/><LiveActivity/></>)}
      {view==='thesis'&&<>
        <section className="iv-page-heading">
          <div><h1>NEAR Adoption Research</h1><p>Follow repeat signer cohorts from a project-level signal to the contracts and transactions behind it.</p></div>
          <div className="iv-page-actions">{dataMode}<a className="iv-outline iv-report-download" href={ranking?.report ?? '/thesis-observed.md'} download><Icon name="down"/>Download report</a></div>
        </section>
        <nav className="iv-research-jump" aria-label="Research sections">
          <a href="#research-findings"><Icon name="observed"/>Findings</a>
          {useReal && coverage && <a href="#repeat-evidence"><Icon name="contracts"/>Contract evidence</a>}
          <a href="#investment-methodology"><Icon name="ranking"/>Investment model</a>
          <a href="#pilot-methodology"><Icon name="research"/>Pilot methods</a>
        </nav>
        <div id="research-findings" className="iv-ecosystem-grid iv-research-summary">
          <section className="iv-card iv-study-card">
            <h2>Is adoption spreading?</h2>
            <p>The pilot asks whether smaller deployments are gaining repeat signers while activity spreads across more contracts.</p>
            {snap && eligible>0 && <div className="iv-research-result"><strong>{signals.length}<small> / {eligible}</small></strong><span>ranked pilot projects met the growth and return thresholds</span></div>}
            <p>{eligible>0 ? 'Public attention is unmeasured in this comparison.' : 'No comparable pilot ranking is available in this snapshot.'}</p>
            {signals.length > 0 && <ul className="iv-signal-list">
              {signals.map(row=><li key={row.id}><Link href={'/app/project/'+row.id+'/'+params}><Badge r={row}/>{row.name}<Icon name="right"/></Link><span>{change(row.g28)} signers · {pct(row.ret)} returned</span></li>)}
            </ul>}
          </section>
          {snap && <figure className="iv-card iv-study-card iv-concentration">
            <figcaption>Top-three share of tracked transactions</figcaption>
            <p>Compare the two 28-day windows for evidence of concentration.</p>
            {([['Previous 28 days',prior.top3],['Latest 28 days',recent.top3]] as const).map(([label,value])=><div className="research-bar" key={label}>
              <span>{label}</span><strong>{pct(value)}</strong><div aria-hidden="true"><i style={{width:100*Number(value??0)+'%'}}/></div>
            </div>)}
            <Link className="iv-text-link" href={'/app/ecosystem/'+params}>Explore ecosystem activity <Icon name="launch"/></Link>
          </figure>}
        </div>
        {useReal && coverage && <section className="panel repeat-evidence" id="repeat-evidence">
          <div className="repeat-heading">
            <div>
              <h2>Largest gains in repeat signers</h2>
              <p>{fmt(coverage.accounts)} contract accounts · {coverage.from} to {coverage.through} UTC</p>
            </div>
            <Link className="method-link" href="/app/deployments/?sort=repeat">View full ranking ↗</Link>
          </div>
          <p>We compare the first two and last two of three consecutive 28-day windows. The third-window return rate follows signers who appeared in both of the first two windows.</p>
          {coverage.leaders.length ? <ol className="repeat-leaders">
            {coverage.leaders.map(({contract,gain,earlier,later,again,method})=><li key={contract}>
              <div>
                <Link href={'/app/deployments/?contract='+encodeURIComponent(contract)}>{contract} ↗</Link>
                <p>{fmt(earlier)} → {fmt(later)} repeat signers</p>
              </div>
              <div><strong>+{fmt(gain)}</strong><span>repeat signer gain</span></div>
              <div><strong>{earlier ? pct(again / earlier) : '—'}</strong><span>{earlier ? `${fmt(again)} of ${fmt(earlier)} returned in window 3` : 'No earlier repeat cohort'}</span></div>
              {method && <p className="repeat-method"><code>{method[0]}</code> · {fmt(method[2])} earlier repeat signers called this in window 2. <a href={'https://nearblocks.io/txns/'+method[3]}>Example transaction ↗</a></p>}
            </li>)}
          </ol> : <p>No contract gained repeat signers in this snapshot.</p>}
          <div className="repeat-sources">
            <span>Signer accounts and direct call attempts, including failures.</span>
            <a href={ranking?.deployments ?? '/deployments.json'} download>Download source rows ↓</a>
          </div>
        </section>}
        <section className="panel iv-ranking-method" id="investment-methodology">
          <h2>How the investment leaderboard works</h2>
          <p>Verified-token projects need qualifying on-chain activity, a NEAR liquidity pool, and comparable valuation data to earn an investment rank.</p>
          <RankingWeights/>
          <p className="iv-method-links"><a href={warehouse}>NEAR Public Lakehouse ↗</a><a href="https://nearblocks.io/">NearBlocks ↗</a><a href="https://dexscreener.com/near">DEX Screener ↗</a></p>
        </section>
        <div className="iv-research-notes" id="pilot-methodology">
          <h2>Pilot methods and limits</h2>
          <details className="iv-card" open>
            <summary>How we count activity</summary>
            <p>We count distinct originating signers and transactions with direct function-call attempts, including failures. We compare adjacent 7- and 28-day UTC windows. Returning share divides the overlap of adjacent 28-day signer cohorts by the previous cohort.</p>
            <p>Pilot weights are 40% adoption, 30% returning share, 15% commit growth, and 15% growth relative to attention. If a dimension is missing for a peer, it is dropped for the cohort and the remaining weights rescale.</p>
            <p>A comparison requires at least three peers. Each needs 50 signers in both 28-day windows and 10 in the prior seven-day window.</p>
            <p><a href={warehouse}>Warehouse schema ↗</a> · <a href="https://docs.github.com/en/rest/commits/commits">GitHub commits API ↗</a></p>
          </details>
          <details className="iv-card"><summary>What would change the finding?</summary><p>Recheck across two subsequent non-overlapping 28-day windows. Revisit the signal if growth reverses, returning share falls below 25%, or removing relayer and campaign activity changes the result.</p></details>
          <details className="iv-card"><summary>What activity tells us about NEAR</summary><p>App usage measures demand for blockspace. Estimating value captured by NEAR holders requires separate evidence for fees, burn, rewards, and issuance.</p></details>
        </div>
      </>}
      </>}
    </main></div>
  </div>;
}
