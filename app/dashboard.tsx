'use client';

import WorkspaceHeading from './workspace-heading';
import ProjectMark from './project-mark';
import {LoadingPanel} from './brand-motion';
import Icon,{type IconName} from './interface-icon';
import ProjectPagination from './project-pagination';
import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {gsap} from 'gsap';
import {CountUp} from './research-graphics';
import {ProjectEvidenceDialog, activityScoreLabels} from './project-evidence';
import {useResearchBoard, type ResearchProject, type ResearchBoard} from './use-research-board';

const number = new Intl.NumberFormat('en-US');
const format = (value:number|null|undefined) => value == null ? '—' : number.format(value);

const scorePoints = new Intl.NumberFormat('en-US',{maximumFractionDigits:1});
const signedSigners = new Intl.NumberFormat('en-US',{signDisplay:'exceptZero'});
const investmentLabels:Record<string,string> = {
  activity:'On-Chain Activity', poolLiquidity:'Pool Reserves', circulatingValuationShare:'Market Cap / FDV',
};

function ProjectChartDetails({project,board,isInvestment}:{
  project:ResearchProject; board:ResearchBoard; isInvestment:boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const {activity} = project;
  const {prior_signers:prior,current_signers:current,repeat_signers:repeat} = activity ?? {};
  const hasTurnover = prior != null && current != null && repeat != null && repeat <= Math.min(prior,current);
  const exited = hasTurnover ? prior-repeat : 0;
  const joined = hasTurnover ? current-repeat : 0;
  const net = joined-exited;
  const turnoverScale = Math.max(exited,joined,1);
  const weights = isInvestment ? board.investmentWeights : board.weights;
  const components = isInvestment ? project.investmentComponents : project.scoreComponents;
  const labels = isInvestment ? investmentLabels : activityScoreLabels;
  const score = isInvestment ? project.performanceScore : project.activityScore;
  const rows = Object.entries(weights ?? {}).flatMap(([key,weight])=>{
    const fraction = components?.[key];
    if (fraction == null || !Number.isFinite(fraction) || !Number.isFinite(weight) || weight <= 0) return [];
    const max = weight * (isInvestment ? 1 : 100);
    return [{key,label:labels[key] ?? key.replaceAll('_',' '),points:fraction*max,max,fraction}];
  });

  useEffect(()=>{
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)',()=>{
      gsap.fromTo('[data-detail-bar]',{scaleX:0},{scaleX:1,duration:0.85,stagger:.055,ease:'power3.out',clearProps:'transform'});
    },ref);
    return ()=>motion.revert();
  },[project.id,isInvestment]);

  return <div className="iv-chart-details" ref={ref}>
    <figure className="iv-card iv-turnover">
      <figcaption><strong>Signer Turnover</strong><span>Across the same 28-day windows</span></figcaption>
      {hasTurnover ? <>
        <p className="iv-chart-total"><strong><CountUp value={signedSigners.format(net)}/></strong><span>net signers</span></p>
        <div className="iv-turnover-plot" aria-hidden="true">
          <div><i data-detail-bar style={{width:`${exited/turnoverScale*100}%`}}/></div>
          <div><i data-detail-bar style={{width:`${joined/turnoverScale*100}%`}}/></div>
        </div>
        <div className="iv-turnover-labels">
          <span><strong>{format(exited)}</strong>Previous window only</span>
          <span><strong>{format(joined)}</strong>Latest window only</span>
        </div>
      </> : <p className="iv-chart-empty">Comparable signer cohorts are unavailable.</p>}
    </figure>
    <figure className="iv-card iv-score">
      <figcaption><strong>Score Breakdown</strong><span>{isInvestment ? 'Investment score' : 'Activity score'}</span></figcaption>
      {rows.length && score != null ? <>
        <p className="iv-chart-total"><strong>{scorePoints.format(score)}</strong><span>/ 100 points</span></p>
        <ul>{rows.map(({key,label,points,max,fraction})=><li key={key}>
          <div><span>{label}</span><span>{scorePoints.format(points)} / {scorePoints.format(max)}</span></div>
          <div className="iv-score-track" aria-hidden="true"><i data-detail-bar style={{width:`${Math.min(1,Math.max(0,fraction))*100}%`}}/></div>
        </li>)}</ul>
      </> : <p className="iv-chart-empty">Component scores are unavailable for this project.</p>}
    </figure>
  </div>;
}

function SignerChart({project}: {project:ResearchProject}) {
  const ref = useRef<HTMLDivElement>(null);
  const [period,setPeriod] = useState<'current'|'previous'>('current');
  const {activity} = project;
  const previous = activity?.prior_signers;
  const current = activity?.current_signers;
  const returning = activity?.repeat_signers;
  const hasCohorts = previous != null && current != null && returning != null;
  const total = (period === 'current' ? current : previous) ?? 0;
  const share = total && returning != null ? Math.round(100 * returning / total) : null;

  useEffect(() => {
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('[data-cohort-bar]',{scaleY:0},{scaleY:1,duration:0.96,stagger:.1,ease:'power3.out'});
      gsap.fromTo('[data-cohort-ring]',{strokeDasharray:'0 100'},{strokeDasharray:`${share ?? 0} 100`,duration:1.08,ease:'power2.out'});
    },ref);
    return () => motion.revert();
  },[project.id,previous,current,returning,share]);

  if (!hasCohorts) return <div className="iv-card iv-unavailable"><h3>Signer Activity</h3><p>Comparable 28-day cohorts are unavailable for {project.name}.</p></div>;

  return <div className="iv-cohorts" ref={ref}>
    <figure className="iv-card iv-chart">
      <figcaption><strong>Signer Activity</strong><span>{project.name}</span></figcaption>
      <div className="iv-plot">
        {([['previous','Previous 28d',previous],['current','Latest 28d',current]] as const).map(([key,label,value])=>
          <button key={key} type="button" aria-pressed={period===key} onClick={()=>setPeriod(key)} className="iv-bar-control"
            aria-label={`${label}: ${format(value)} signers, ${format(returning)} in both windows`}>
            <span className="iv-bar-plot"><span data-cohort-bar className="iv-bar" style={{height:`${value / Math.max(1, previous, current) * 85}%`}}>
              <span style={{height:`${value ? 100 * returning / value : 0}%`}}/>
              <strong>{format(value)}</strong>
            </span></span>
            <span>{label}</span>
          </button>)}
      </div>
      <p className="iv-legend"><i aria-hidden="true"/> Appeared in both windows</p>
    </figure>
    <figure className="iv-card iv-return">
      <figcaption><strong>{period === 'current' ? 'Returning Share' : 'Cohort Retention'}</strong><span>{period === 'current' ? 'Of latest-window signers' : 'Of previous-window signers'}</span></figcaption>
      <div className="iv-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42"/><circle data-cohort-ring cx="50" cy="50" r="42" pathLength="100" strokeDasharray={`${share ?? 0} 100`}/></svg>
        <strong><CountUp value={share == null ? '—' : share + '%'}/></strong>
      </div>
      <p aria-live="polite">{format(returning)} signers appeared in both windows.</p>
    </figure>
  </div>;
}

function OverviewMetric({label,value,note,icon}:{label:string;value:number|string;note:string;icon:IconName}) {
  const card=useRef<HTMLElement>(null);
  const title=useRef<HTMLHeadingElement>(null);
  const [outline,setOutline]=useState({width:320,height:144,notch:190,depth:36});
  useEffect(()=>{
    const surface=card.current;
    const heading=title.current;
    if (!surface || !heading) return;
    const observer=new ResizeObserver(()=>{
      const {width,height}=surface.getBoundingClientRect();
      if (!width || !height) return;
      setOutline({width,height,notch:heading.offsetWidth+3,depth:heading.offsetHeight});
    });
    observer.observe(surface);
    observer.observe(heading);
    return ()=>observer.disconnect();
  },[]);
  const {width,height,notch,depth}=outline;
  const edge=width-.5;
  const floor=height-.5;
  const curve=10;
  const path=`M ${notch+curve} .5 H ${edge-curve} Q ${edge} .5 ${edge} ${curve+.5}
    V ${floor-curve} Q ${edge} ${floor} ${edge-curve} ${floor}
    H ${curve+.5} Q .5 ${floor} .5 ${floor-curve}
    V ${depth+curve} Q .5 ${depth} ${curve+.5} ${depth}
    H ${notch-curve} Q ${notch} ${depth} ${notch} ${depth-curve}
    V ${curve+.5} Q ${notch} .5 ${notch+curve} .5 Z`;
  return <article className="iv-card iv-metric" ref={card}>
    <svg className="iv-metric-shape" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} vectorEffect="non-scaling-stroke"/>
    </svg>
    <h2 className="iv-metric-notch" ref={title}><Icon name={icon}/>{label}</h2>
    <div className="iv-metric-body"><strong><CountUp value={value}/></strong><p>{note}</p></div>
  </article>;
}

export default function Dashboard() {
  const {board,failed} = useResearchBoard();
  const [mode,setMode] = useState<'investment'|'activity'|'all'|null>(null);
  const [page,setPage] = useState(0);
  const [projectId,setProjectId] = useState<string|null>(null);
  const [evidenceId,setEvidenceId] = useState<string|null>(null);
  if (!board) return <section className="iv-overview-wait">
    <LoadingPanel title="Welcome Back" description={failed ? 'The research feed is temporarily unavailable. Retrying shortly.' : 'Loading your NEAR overview…'}/>
  </section>;
  const results = board?.projects ?? [];
  const investment = results.filter(project=>project.performanceRank!=null).sort((a,b)=>a.performanceRank!-b.performanceRank!);
  const activity = results.filter(project=>project.activityRank!=null).sort((a,b)=>a.activityRank!-b.activityRank!);
  const visibleMode = mode ?? (!investment.length && activity.length ? 'activity' : 'investment');
  const isInvestment = visibleMode==='investment';
  const projects = visibleMode==='all' ? [...results].sort((a,b)=>a.name.localeCompare(b.name)) : isInvestment ? investment : activity;
  const currentPage = Math.max(0,Math.min(page,Math.ceil(projects.length/5)-1));
  const preview = projects.slice(currentPage*5,(currentPage+1)*5);
  function selectMode(next:'investment'|'activity'|'all') {
    setMode(next);
    setPage(0);
    setProjectId(null);
    setEvidenceId(null);
  }
  const project = preview.find(row=>row.id===projectId) ?? preview[0];
  const evidenceProject = results.find(row=>row.id===evidenceId);
  const chartSelection = project?.id;
  const metricCards = [
    {label:'Verified-Token Projects', value: board ? results.length : '—', note:'Projects with attributed token contracts', icon:'check'},
    {label:'Activity-Ranked', value:board ? activity.length : '—', note:'Meet the signer and coverage thresholds', icon:'observed'},
    {label:'Investment-Ranked', value:board?.marketCheckedAt ? investment.length : '—', note:'Also have comparable pool and valuation data', icon:'ranking'},
    {label:'Returning Signers', value:results.reduce((total,project)=>Math.max(total,project.activity?.repeat_signers ?? 0),0) || '—', note:'Largest measured project cohort', icon:'repeat'},
  ] as const;

  return <section className="iv-dashboard iv-ready-fade" aria-labelledby="iv-discover-title">
      <div className="iv-dash-content">
        <WorkspaceHeading id="iv-discover-title" title="Discover NEAR Projects" description="Compare usage, market evidence, and research scores."
          actions={failed && <span className="iv-asof" role="status">Last available snapshot</span>}/>
        <div className="iv-metrics iv-overview-metrics">
          {metricCards.map(metric=><OverviewMetric key={metric.label} {...metric}/>)}
        </div>
        <div className="iv-ranking-grid">
          <section className="iv-card iv-board" aria-labelledby="iv-leaderboard-title">
            <div className="iv-board-head">
              <h3 id="iv-leaderboard-title">Project Leaderboard</h3>
              <div className="iv-switch" aria-label="Ranking view">
                <button type="button" disabled={!board.marketCheckedAt} aria-pressed={isInvestment} onClick={()=>selectMode('investment')}><Icon name="ranking"/>Investment</button>
                <button type="button" aria-pressed={visibleMode==='activity'} onClick={()=>selectMode('activity')}><Icon name="observed"/>Activity</button>
                <button type="button" aria-pressed={visibleMode==='all'} onClick={()=>selectMode('all')}><Icon name="contracts"/>All verified</button>
              </div>
            </div>
            {preview.length ? <table>
              <thead><tr><th scope="col">Project</th><th scope="col">28d signers</th><th scope="col">Score</th><th scope="col" aria-label="Project evidence"/></tr></thead>
              <tbody>{preview.map(row=><tr key={row.id} data-selected={row.id===chartSelection}>
                <th scope="row"><button type="button" aria-pressed={row.id===chartSelection} onClick={()=>setProjectId(row.id)}>
                  <span className="iv-rank">{(isInvestment ? row.performanceRank : row.activityRank) ?? '—'}</span>
                  <ProjectMark id={row.id}/><span>{row.name}<small>{row.tokens.map(token=>token.symbol).join(' · ')}</small></span>
                </button></th>
                <td>{format(row.activity?.current_signers)}</td><td className="iv-row-score">{format(isInvestment ? row.performanceScore : row.activityScore)}</td>
                <td className="iv-row-evidence"><button type="button" aria-haspopup="dialog" aria-label={`Inspect ${row.name} evidence`}
                  onClick={event=>{event.currentTarget.focus({preventScroll:true});setEvidenceId(row.id);}}><Icon name="search"/></button></td>
              </tr>)}</tbody>
            </table> : <p className="iv-board-state" role="status">{board ? (isInvestment && board.performanceRankingStatus==='market_source_unavailable' ? 'Market data is temporarily unavailable. Switch to Activity to see the on-chain ranking.' : 'No eligible projects in this ranking yet.') : 'The research feed is temporarily unavailable. This page retries every minute.'}</p>}
            <ProjectPagination page={currentPage} pageSize={5} total={projects.length} onPageChange={next=>{
              setPage(next);setProjectId(null);setEvidenceId(null);
            }}/>
            <Link className="iv-text-link iv-board-more" href="/app/discovery/?data=observed">Open full leaderboard <Icon name="launch"/></Link>
          </section>
          {project ? <div className="iv-project-charts iv-ready-fade">
            <SignerChart key={project.id} project={project}/>
            <ProjectChartDetails project={project} board={board} isInvestment={isInvestment}/>
          </div> : <div className="iv-card iv-unavailable"><h3>Signer Activity</h3><p>Compare the latest and previous 28-day cohorts when ranked activity is available.</p></div>}
        </div>
        {evidenceProject && <ProjectEvidenceDialog key={evidenceProject.id} projectId={evidenceProject.id} market={evidenceProject.market} weights={board?.weights} onDismiss={()=>setEvidenceId(null)}/>}
      </div>
  </section>;
}
