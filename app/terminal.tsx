'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ResearchChart, ReturningShare, CountUp} from './research-graphics';
import ActivityRankings from './activity-rankings';
import activityRegistry from '../data/activity-registry.json';
import DeploymentAtlas from './deployment-atlas';
import EcosystemStory from './ecosystem-story';
import projects from '../data/projects.json';
import observed from '../data/observed.json';
import {CohortEvidence, LiveActivity} from './onchain-evidence';
import {demo} from '../lib/demo.mjs';
import {rank, concentration, pct, change, dateAt} from '../lib/model.mjs';

import {summarizeDeployments, type DeploymentSummary} from './summarize-deployments';
import {useRankingRelease} from './use-ranking-release';
import type {Metric,Snapshot,Row} from '../lib/model.mjs';
const fictional=demo(projects) as Snapshot;
const fmt=(n:number|null|undefined)=>n==null?'—':n.toLocaleString('en-US');
const warehouse='https://github.com/near/near-public-lakehouse#examples';
const views=[['discovery','/','Discovery'],['deployments','/deployments/','Deployments'],['ecosystem','/ecosystem/','Ecosystem'],['thesis','/thesis/','Research']];
const marks:Record<string,string>={linear:'linear.jpg',metapool:'metapool.svg',social:'social.svg',ref:'ref.png',burrow:'ref.png',intents:'intents.png',aurora:'aurora.jpg',sweat:'sweat.svg',sputnik:'sputnik.jpg',wrap:'wrap.png'};
function Sparkline({values,label}:{values:number[];label:string}){
  if(values.length<2)return null;
  const max=Math.max(1,...values);
  const points=values.map((value,i)=>`${i*146/(values.length-1)},${37-value/max*32}`).join(' ');
  return <svg className="spark" viewBox="0 0 146 40" role="img" aria-label={label} preserveAspectRatio="none"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke"/></svg>;
}
function SelectControl({label,value,onChange,children}:{label:string;value:string;onChange:(value:string)=>void;children:React.ReactNode}){
  return <label className="select-control"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{children}</select><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></label>;
}
function Stat({label,value,note}:{label:string;value:string|number;note:string}){return <div className="stat"><div className="micro">{label}</div><strong><CountUp value={value}/></strong><small>{note}</small></div>;}
function Badge({r}:{r:Row}){
  return <span className={'badge badge-'+r.id}><img src={'/marks/'+marks[r.id]} alt="" width="32" height="32"/></span>;
}
function Signal({r,demoMode}:{r:Row;demoMode:boolean}){
  return <p className="signal-text">{demoMode?'Scenario: ':''}{change(r.g28)} over 28 days and {change(r.g7)} over 7 days. {fmt(r.m?.repeat)} previous-window signers returned ({pct(r.ret)}). {r.att==null?'Public attention is unmeasured.':`Attention changed ${change(r.att)} over 28 days.`}</p>;
}
export default function Terminal({view,id,coverage:initialCoverage}:{view:string;id?:string;coverage?:DeploymentSummary}){
  const [real,setReal]=useState<boolean|null>(null),[cat,setCat]=useState('All'),[query,setQuery]=useState(''),[minGrowth,setGrowth]=useState('all'),[minRetention,setRetention]=useState('all'),[minScore,setScore]=useState('all');
  const [sort,setSort]=useState('score');
  const [dark,setDark]=useState(false);
  useEffect(()=>{
    const saved=localStorage.getItem('invisible-theme');
    const preferred=saved?saved==='dark':matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(preferred);
    document.documentElement.dataset.theme=preferred?'dark':'light';
  },[]);
  function toggleTheme(){
    const next=!dark;
    setDark(next);
    document.documentElement.dataset.theme=next?'dark':'light';
    localStorage.setItem('invisible-theme',next?'dark':'light');
  }
  const useReal=real??true;
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
  const snap:Snapshot|null=useReal?(ranking?.snapshot ?? observed):fictional;
  const params=(useReal?'?data=observed':'?data=demo');
  // Preserve the selected dataset across directly addressable pages.
  useEffect(()=>{const v=new URLSearchParams(window.location.search).get('data');setReal(v==='observed'?true:v==='demo'?false:null);},[view,id]);
  function switchMode(v:boolean){setReal(v);window.history.replaceState(null,'',window.location.pathname+(v?'?data=observed':'?data=demo'));}
  const {rows,mode,eligible}=rank(projects,snap);
  const signals=rows.filter(r=>r.signal),featured=signals[0],project=rows.find(r=>r.id===id);
  const visible=rows.filter(r=>(cat==='All'||cat===r.category)&&[r.name,...r.contracts].some(x=>x.toLowerCase().includes(query.trim().toLowerCase()))&&(minGrowth==='all'||(r.g28??-Infinity)>=Number(minGrowth))&&(minRetention==='all'||(r.ret??-Infinity)>=Number(minRetention))&&(minScore==='all'||(r.score??-Infinity)>=Number(minScore)));
  if(sort==='name')visible.sort((a,b)=>a.name.localeCompare(b.name));
  if(sort==='growth')visible.sort((a,b)=>(b.g28??-Infinity)-(a.g28??-Infinity));
  if(sort==='retention')visible.sort((a,b)=>(b.ret??-Infinity)-(a.ret??-Infinity));
  function clearFilters(){setQuery('');setCat('All');setGrowth('all');setRetention('all');setScore('all');}
  const recent=concentration(rows.flatMap(r=>r.m?.contracts.map((c:Metric['contracts'][number])=>c.tx)??[]));
  const prior=concentration(rows.flatMap(r=>r.m?.contracts.map((c:Metric['contracts'][number])=>c.prevTx)??[]));
  const footer=<footer><span>INVISIBLE RESEARCH</span><span>NEAR MAINNET SCOPE &nbsp; / &nbsp; MODEL 1.0</span></footer>;
  const history=project?.m?.daily??[];
  return <div className="shell" data-view={view}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="masthead">
      <div className="masthead-inner">
        <Link href={'/'+params} className="brand" aria-label="Invisible home">
          <img src="/icon.svg" className="brandmark" width="30" height="30" alt=""/>
          <span>Invisible</span>
        </Link>
        <nav aria-label="Workspace">{views.map(([v,url,name])=>{
          const active=v===view||(v==='discovery'&&view==='project');
          return <Link key={v} className={active?'active':''} aria-current={v===view?'page':undefined} href={url+params}>{name}</Link>;
        })}</nav>
        <div className="header-actions">
          {view!=='deployments'&&<div className="modes" aria-label="Data mode">
            <button onClick={()=>switchMode(true)} aria-pressed={useReal}>Observed</button>
            <button onClick={()=>switchMode(false)} aria-pressed={!useReal}>Simulation</button>
          </div>}
          <button className="theme-toggle" onClick={toggleTheme} aria-label={dark?'Switch to light mode':'Switch to dark mode'} title={dark?'Light mode':'Dark mode'}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">{dark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/></>:<path d="M20.5 15A8.5 8.5 0 0 1 9 3.5 8.6 8.6 0 1 0 20.5 15Z"/>}</svg>
          </button>
        </div>
      </div>
    </header>
    <div className="workspace">
    <main id="main-content">
      {view==='deployments'&&<DeploymentAtlas snapshotPath={release?.deployments}/>}
      {!useReal&&view!=='deployments'&&view!=='discovery'&&view!=='ecosystem'&&<p className="sample-note">Simulation · illustrative metrics</p>}
      {view==='discovery'&&<>
        {useReal ? <>
          <section className="discovery-hero" aria-labelledby="discovery-title">
            <div className="discovery-lead">
              <h1 id="discovery-title">Find what’s<br/>growing on NEAR.</h1>
              <p>Follow the projects gaining signers and bringing them back. See the contracts and transactions behind each ranking.</p>
              <div className="discovery-actions">
                <a className="discovery-primary" href="#project-rankings">Explore rankings <span aria-hidden="true">↓</span></a>
                <Link href="/thesis/?data=observed">Read the research <span aria-hidden="true">↗</span></Link>
              </div>
            </div>
            <LiveActivity/>
          </section>
          <section className="discovery-projects" aria-labelledby="project-rankings">
            <div className="discovery-section-heading">
              <div><h2 id="project-rankings">Project rankings</h2>
                <p>Projects with a verified NEAR token, scored on signer growth, return rate, and days active.</p></div>
              <a href="#project-registry">View project coverage <span aria-hidden="true">↓</span></a>
            </div>
            <ActivityRankings/>
          </section>
          <section className="discovery-directory" aria-labelledby="project-registry">
            <div className="discovery-section-heading">
              <div><h2 id="project-registry">Project coverage</h2>
                <p>{activityRegistry.length} verified token projects · {activityRegistry.reduce((count, entry)=>count+Object.keys(entry.contracts).length,0)} mapped contracts. Open a project to see its sources.</p></div>
            </div>
            <div className="discovery-registry">{activityRegistry.map(entry=><details key={entry.id}>
              <summary><strong>{entry.name}</strong><span>{entry.tokens.map(token=>token.symbol).join(', ')}</span></summary>
              <div className="registry-evidence">
                <p>{entry.description} {entry.benchmark && 'Tracked for reference, outside the rankings.'}</p>
                <ul>
                  {entry.tokens.map(token=><li key={token.accountId}><a href={token.evidence}>{token.symbol} token evidence ↗</a><code>{token.accountId}</code></li>)}
                  {Object.entries(entry.contracts).map(([account, source])=><li key={account}>
                    <Link href={'/deployments/?contract='+encodeURIComponent(account)}>{account}</Link><a href={source}>Source ↗</a>
                  </li>)}
                </ul>
              </div>
            </details>)}</div>
          </section>
          <div className="discovery-contracts"><DeploymentAtlas snapshotPath={release?.deployments} compact /></div>
        </> : <section className="intro">
          <h1>Explore a simulated ranking</h1>
          <p>Compare signer growth and return activity using sample data.</p>
          <div className="intro-meta"><span><b>{projects.length}</b> tracked projects</span>
            {signals.length > 0 && <span><b>{signals.length}</b> qualifying signals</span>}
            <span>Simulation data</span>
          </div>
        </section>}
        {!useReal && <>
        {featured&&snap?<section className="feature">
          <div className="feature-copy">
            <div className="feature-title"><Badge r={featured}/><h2>{featured.name}</h2></div>
            <p><strong>{change(featured.g28)}</strong> active signers vs. the previous 28 days.<br/>{fmt(featured.m?.repeat)} signers returned ({pct(featured.ret)}).</p>
            <Link className="feature-link" href={'/project/'+featured.id+'/'+params}>Inspect evidence <span aria-hidden>↗</span></Link>
          </div>
          <div className="feature-chart">
            <div className="feature-figure">Daily active signers</div>
            <ResearchChart values={featured.m?.daily.map(d=>d.accounts)??[]} days={featured.m?.daily.map(d=>d.day)} label={featured.name+' daily active signers across two 28-day windows'} split/>
            <div className="feature-axis">
              <span>Previous window<small>{dateAt(snap.end,-56)} to {dateAt(snap.end,-29)}</small></span>
              <span>Current window<small>{dateAt(snap.end,-28)} to {dateAt(snap.end,-1)}</small></span>
            </div>
          </div>
        </section>:null}
        <section className="feed">
          <div className="section-title"><h2>Simulated project rankings</h2><Link className="method-link" href={'/thesis/'+params}>How we rank projects ↗</Link></div>
        <div className="filters">
          <label className="search-control"><span className="sr-only">Search projects</span><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="m12 12 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg><input placeholder="Search projects or contracts" value={query} onChange={e=>setQuery(e.target.value)}/></label>
          <SelectControl label="Category" value={cat} onChange={setCat}>{['All',...new Set(projects.map(p=>p.category))].map(c=><option key={c} value={c}>{c==='All'?'All categories':c}</option>)}</SelectControl>
          <SelectControl label="Growth" value={minGrowth} onChange={setGrowth}><option value="all">Any growth</option><option value="0">0% and up</option><option value=".25">25% and up</option><option value=".5">50% and up</option></SelectControl>
          <SelectControl label="Retention" value={minRetention} onChange={setRetention}><option value="all">Any retention</option><option value=".25">25% and up</option><option value=".4">40% and up</option></SelectControl>
          <SelectControl label="Score" value={minScore} onChange={setScore}><option value="all">Any score</option><option value="50">50 and up</option><option value="75">75 and up</option></SelectControl>
          <SelectControl label="Sort by" value={sort} onChange={setSort}><option value="score">Score</option><option value="growth">28-day growth</option><option value="retention">Returning share</option><option value="name">Project name</option></SelectControl>
        </div>
        <p className="result-count" aria-live="polite">{visible.length} of {rows.length} deployments</p>
        <div className="list">
          <div className="list-head"><span>PROJECT</span><span>7D / 28D GROWTH</span><span>RETURNING</span><span>DEV / ATTENTION</span><span>DAILY SIGNERS</span><span>SCORE</span></div>
          {visible.map(r=><Link className="project-row" key={r.id} href={'/project/'+r.id+'/'+params}>
            <div className="identity"><Badge r={r}/><div><strong>{r.name}</strong><div className="category">{r.category}{r.benchmark?' · Benchmark':''}{r.signal&&<span className="row-signal"> · {r.signal}</span>}</div></div></div>
            <div className="pair"><small>7D / 28D</small><span>{change(r.g7)} / <b className={(r.g28??0)>0?'up':''}>{change(r.g28)}</b></span></div>
            <div className="pair"><small>Returning</small>{pct(r.ret)}</div>
            <div className="pair"><small>Dev / attention</small>{change(r.dev)} / {change(r.att)}</div>
            <div className="activity">{r.m?<Sparkline values={r.m.daily.slice(-28).map(d=>d.accounts)} label={r.name+' daily signers'}/>:<span className="micro">—</span>}</div>
            <div className="score">{r.score??'—'} <span aria-hidden>↗</span></div>
          </Link>)}
        {!visible.length&&<div className="blank"><p>No projects match these filters.</p><button onClick={clearFilters}>Clear filters</button></div>}</div></section>
        </>}
      </>}
      {view==='project'&&project&&<>
        <Link className="back" href={'/'+params}>← Back to discovery</Link>
        <section className="detail-head"><div className="detail-name"><Badge r={project}/><h1>{project.name}</h1></div><p>{project.description}</p>{useReal&&<Link className="back" href={'/deployments/?contract='+encodeURIComponent(project.contracts[0])}>View three-window signer evidence ↗</Link>}</section>
        {useReal&&<><LiveActivity contract={project.contracts[0]}/><CohortEvidence projectId={project.id}/></>}
        <div className="stats"><Stat label={mode.toUpperCase()} value={project.score??'—'} note={project.benchmark?'Benchmark · excluded from ranking':`${eligible} eligible peers`}/><Stat label="ACTIVE SIGNERS / 28D" value={fmt(project.m?.a28)} note={`${change(project.g28)} vs previous 28 days`}/><Stat label="RETURNING / 28D" value={pct(project.ret)} note={`${fmt(project.m?.repeat)} of ${fmt(project.m?.b28)} previous signers`}/><Stat label="TRANSACTIONS / 28D" value={fmt(project.m?.tx)} note={`Previous: ${fmt(project.m?.prevTx)}`}/></div>
        <section className="panel"><div className="section-title"><h2>Daily active signers</h2><span className="micro">56 DAYS / UTC</span></div><ResearchChart values={history.map(d=>d.accounts)} days={history.map(d=>d.day)} label="Daily active signers, 56 days" stepped split/>{snap&&<div className="axis"><span>{dateAt(snap.end,-56)}</span><span>{dateAt(snap.end,-28)}</span><span>{dateAt(snap.end,-1)}</span></div>}</section>
        {project.m&&<ReturningShare prior={project.m.b28} current={project.m.a28} repeat={project.m.repeat}/>}
        <div className="columns"><section className="panel"><h2>{project.signal??'No qualified signal'}</h2>{project.m?<Signal r={project} demoMode={!useReal}/>:<p>No measured project metrics are available.</p>}<p>{project.signal?`${project.confidence} heuristic confidence. Repeat activity supports persistence across two windows; this does not establish a cause.`:'A signal requires ≥25% 28-day growth, positive 7-day growth, ≥25% returning signers and ≥25 net signers, after eligibility checks.'}</p><p>{project.risk}</p></section><section className="panel"><h2>Adoption vs. attention</h2><dl><dt>7-day change</dt><dd>{change(project.g7)}</dd><dt>28-day adoption change</dt><dd>{change(project.g28)}</dd><dt>28-day attention change</dt><dd>{project.att==null?'Unavailable':change(project.att)}</dd><dt>Default-branch commits, current / prior</dt><dd>{project.m?.commits?.join(' / ')??'Unavailable'}</dd>{project.components&&Object.entries(project.components).map(([k,v])=><div className="dl-row" key={k}><dt>{k} percentile</dt><dd>{v==null?'Excluded':Math.round(Number(v))}</dd></div>)}</dl><p>Effective weight denominator: {project.components?project.weight:'—'}. <Link href={'/thesis/'+params}>Read the model ↗</Link></p></section></div>
        <section className="panel"><h2>Contracts and evidence</h2>{project.contracts.map((c:string)=><div className="evidence" key={c}><a href={'https://nearblocks.io/address/'+c}>{c} ↗</a><span>{fmt(project.m?.contracts.find((x:Metric['contracts'][number])=>x.contract===c)?.tx)} tx / 28d</span></div>)}<p><a href={project.source}>Attribution source ↗</a> &nbsp; <a href={warehouse}>Warehouse schema ↗</a>{project.repo&&<> &nbsp; <a href={'https://github.com/'+project.repo+'/commits'}>Repository commits ↗</a></>}</p><p>{snap?.provenance??'No export run loaded.'}</p></section>
      </>}
      {view==='ecosystem' && (snap
        ? <EcosystemStory rows={rows} snapshot={snap} params={params} observed={useReal}/>
        : <LiveActivity/>)}
      {view==='thesis'&&<>
        <section className="research-hero">
          <div>
            <h1>Is adoption spreading across NEAR?</h1>
            <p>Compare activity across the pilot projects, then follow the contracts that gained repeat signers back to the calls those signers made.</p>
            <a className="button" href={useReal?(ranking?.report ?? '/thesis-observed.md'):'/thesis-demo.md'} download>Download report ↓</a>
            {!useReal&&<button className="research-switch" onClick={()=>switchMode(true)}>Read observed findings →</button>}
          </div>
          <div className="research-takeaway">
            <h2>{!useReal?'Simulation preview':snap?'What the snapshot shows':'Waiting for a snapshot'}</h2>
            <p>{!useReal?'The example below illustrates how the report works. Switch to Observed for measured activity.':snap?`${signals.length} of ${eligible} ranked projects met the growth and return thresholds. We have yet to measure public attention for this comparison.`:'Load an observed snapshot to evaluate the research question.'}</p>
            {snap&&<figure>
              <figcaption>Share of tracked transactions in the top three contracts</figcaption>
              {([['Previous 28 days',prior.top3],['Latest 28 days',recent.top3]] as const).map(([label,value])=><div className="research-bar" key={label}><span>{label}</span><strong>{pct(value)}</strong><div><i style={{width:100*Number(value??0)+'%'}}/></div></div>)}
            </figure>}
          </div>
        </section>
        {useReal && coverage && <section className="panel repeat-evidence">
          <div className="repeat-heading">
            <div>
              <h2>Largest gains in repeat signers</h2>
              <p>{fmt(coverage.accounts)} contract accounts · {coverage.from} to {coverage.through} UTC</p>
            </div>
            <Link className="method-link" href="/deployments/?sort=repeat">View full ranking ↗</Link>
          </div>
          <p>We compare the first two and last two of three consecutive 28-day windows. The third-window return rate follows signers who appeared in both of the first two windows.</p>
          {coverage.leaders.length ? <ol className="repeat-leaders">
            {coverage.leaders.map(({contract,gain,earlier,later,again,method})=><li key={contract}>
              <div>
                <Link href={'/deployments/?contract='+encodeURIComponent(contract)}>{contract} ↗</Link>
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
        <div className="thesis-article">
        <section className="panel"><h2>The claim and the evidence</h2><p>Smaller NEAR deployments may gain repeat signers before public attention catches up. If activity spreads across more contracts, the top three should account for a smaller share over time.</p>{signals.map(r=><p key={r.id}><Link href={'/project/'+r.id+'/'+params}>{r.name} ↗</Link> · {change(r.g28)} growth, {pct(r.ret)} returning</p>)}<p>The concentration figures above cover the tracked contracts. Use <Link href={'/ecosystem/'+params}>Ecosystem</Link> to see where transaction volume changed.</p></section>
        <section className="panel"><h2>Methodology</h2><p>Count distinct originating signers and distinct transactions containing direct function-call attempts. Compare adjacent 7- and 28-day UTC windows. Returning share divides the overlap of adjacent 28-day signer cohorts by the previous cohort.</p><p>Midpoint percentiles against eligible pilot peers: 40% adoption (25% 7-day and 75% 28-day growth), 30% returning share, 15% commit growth, 15% growth minus attention growth. A missing dimension for any peer removes it for the whole cohort and the remaining weights rescale. At least three peers, 50 signers in both 28-day windows and 10 in the prior 7-day window are required. This small mixed-category cohort is exploratory.</p><p><a href={warehouse}>NEAR Public Lakehouse ↗</a> · <a href="https://docs.github.com/en/rest/commits/commits#list-commits">GitHub commits API ↗</a> · <a href="https://nearhackathon.com/">Track brief ↗</a></p></section>
        <section className="panel"><h2>What would change the thesis?</h2><p>Recheck over two subsequent non-overlapping 28-day windows. Drop candidates if growth reverses, repeat share falls below 25%, or the signal vanishes after relayer and campaign adjustments. Reject the broader diversification claim if top-three share and HHI do not decline across those windows.</p><h2>NEAR value capture</h2><p>App usage is evidence about demand for blockspace. It does not quantify the benefit to NEAR holders. Test fee and burn changes net of rewards and issuance separately, and distinguish protocol fees from app revenue, deposits and staking flows.</p></section>
        </div>
      </>}
      {footer}
    </main></div>
  </div>;
}
