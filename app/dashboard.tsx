'use client';

import ProjectMark from './project-mark';
import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {gsap} from 'gsap';
import {CountUp} from './research-graphics';
import {ProjectEvidence} from './activity-rankings';
import {useResearchBoard, type ResearchProject} from './use-research-board';

const number = new Intl.NumberFormat('en-US');
const format = (value:number|null|undefined) => value == null ? '—' : number.format(value);

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
      gsap.fromTo('[data-cohort-bar]',{scaleY:0},{scaleY:1,duration:.62,stagger:.1,ease:'power3.out'});
      gsap.fromTo('[data-cohort-ring]',{strokeDasharray:'0 100'},{strokeDasharray:`${share ?? 0} 100`,duration:.7,ease:'power2.out'});
    },ref);
    return () => motion.revert();
  },[project.id,previous,current,returning,share]);

  if (!hasCohorts) return <div className="iv-card iv-unavailable"><h3>Signer activity</h3><p>Comparable 28-day cohorts are unavailable for {project.name}.</p></div>;

  return <div className="iv-cohorts" ref={ref}>
    <figure className="iv-card iv-chart">
      <figcaption><strong>Signer activity</strong><span>{project.name}</span></figcaption>
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
      <figcaption><strong>{period === 'current' ? 'Returning share' : 'Cohort retention'}</strong><span>{period === 'current' ? 'Of latest-window signers' : 'Of previous-window signers'}</span></figcaption>
      <div className="iv-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42"/><circle data-cohort-ring cx="50" cy="50" r="42" pathLength="100" strokeDasharray={`${share ?? 0} 100`}/></svg>
        <strong><CountUp value={share == null ? '—' : share + '%'}/></strong>
      </div>
      <p aria-live="polite">{format(returning)} signers appeared in both windows.</p>
    </figure>
  </div>;
}

export default function Dashboard() {
  const {board,failed} = useResearchBoard();
  const [mode,setMode] = useState<'investment'|'activity'|null>(null);
  const [projectId,setProjectId] = useState<string|null>(null);
  const [evidenceOpen,setEvidenceOpen] = useState(false);
  const evidencePanel = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if (!evidenceOpen || !evidencePanel.current) return;
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)',()=>{
      gsap.fromTo(evidencePanel.current,{y:7,opacity:0},{y:0,opacity:1,duration:.38,ease:'power2.out',clearProps:'opacity,transform'});
    });
    return ()=>motion.revert();
  },[evidenceOpen]);
  const results = board?.projects ?? [];
  const investment = results.filter(project=>project.performanceRank!=null).sort((a,b)=>a.performanceRank!-b.performanceRank!);
  const activity = results.filter(project=>project.activityRank!=null).sort((a,b)=>a.activityRank!-b.activityRank!);
  const visibleMode = mode ?? (!investment.length && activity.length ? 'activity' : 'investment');
  const isInvestment = visibleMode==='investment';
  const projects = isInvestment ? investment : activity;
  const preview = projects.slice(0,5);
  const project = preview.find(row=>row.id===projectId) ?? preview[0];
  const lastDay = board?.cutoff ? new Date(Date.parse(board.cutoff)-1).toISOString().slice(0,10) : null;
  const chartSelection = project?.id;
  const metricCards = [
    {label:'Verified-token projects', value: board ? results.length : '—', note:'Projects with attributed token contracts', icon:'◇'},
    {label:'Activity-ranked', value:board ? activity.length : '—', note:'Meet the signer and coverage thresholds', icon:'↗'},
    {label:'Investment-ranked', value:board ? investment.length : '—', note:'Also have comparable pool and valuation data', icon:'≋'},
  ];

  return <section className="iv-dashboard" aria-labelledby="iv-discover-title">
      <div className="iv-dash-content">
        <div className="iv-dash-head"><div><h1 id="iv-discover-title">Discover NEAR projects</h1><p>Compare usage, market evidence, and research scores.</p></div>
          <span className="iv-asof" role="status">{failed && board ? 'Last available snapshot' : lastDay ? `Through ${lastDay} UTC` : board ? 'Snapshot pending' : failed ? 'Data unavailable' : 'Loading rankings'}</span>
        </div>
        <div className="iv-metrics">
          {metricCards.map(({label,value,note,icon})=><article className="iv-card iv-metric" key={label}>
            <span><i aria-hidden="true">{icon}</i>{label}</span><strong><CountUp value={value}/></strong><p>{note}</p>
          </article>)}
        </div>
        <div className="iv-ranking-grid">
          <section className="iv-card iv-board" aria-labelledby="iv-leaderboard-title">
            <div className="iv-board-head">
              <h3 id="iv-leaderboard-title">Project leaderboard</h3>
              <div className="iv-switch" aria-label="Ranking view">
                <button type="button" aria-pressed={isInvestment} onClick={()=>{setMode('investment');setEvidenceOpen(false);}}>Investment</button>
                <button type="button" aria-pressed={!isInvestment} onClick={()=>{setMode('activity');setEvidenceOpen(false);}}>Activity</button>
              </div>
            </div>
            {board && preview.length ? <table>
              <thead><tr><th scope="col">Project</th><th scope="col">28d signers</th><th scope="col">Score</th></tr></thead>
              <tbody>{preview.map(row=><tr key={row.id} data-selected={row.id===chartSelection}>
                <th scope="row"><button type="button" aria-pressed={row.id===chartSelection} onClick={()=>{setProjectId(row.id);setEvidenceOpen(false);}}>
                  <span className="iv-rank">{isInvestment ? row.performanceRank : row.activityRank}</span>
                  <ProjectMark id={row.id}/><span>{row.name}<small>{row.tokens.map(token=>token.symbol).join(' · ')}</small></span>
                </button></th>
                <td>{format(row.activity?.current_signers)}</td><td>{format(isInvestment ? row.performanceScore : row.activityScore)}</td>
              </tr>)}</tbody>
            </table> : <p className="iv-board-state" role="status">{board ? (isInvestment && board.performanceRankingStatus==='market_source_unavailable' ? 'Market data is temporarily unavailable. Switch to Activity to see the on-chain ranking.' : 'No eligible projects in this ranking yet.') : failed ? 'The research feed is temporarily unavailable. This page retries every minute.' : 'Loading the latest verified project rankings…'}</p>}
            <Link className="iv-text-link iv-board-more" href="/discovery/">Open full leaderboard <span aria-hidden="true">↗</span></Link>
          </section>
          {project ? <SignerChart key={project.id} project={project}/> : <div className="iv-card iv-unavailable"><h3>Signer activity</h3><p>Compare the latest and previous 28-day cohorts when ranked activity is available.</p></div>}
        </div>
        {project && <section className="iv-card iv-evidence-card">
          <div><h3>{project.name} evidence</h3><p>Inspect the contracts and sources behind this row.</p></div>
          <button type="button" className="iv-outline" aria-expanded={evidenceOpen} aria-controls="iv-project-evidence" onClick={()=>setEvidenceOpen(!evidenceOpen)}>{evidenceOpen ? 'Hide evidence' : 'Inspect evidence'} <span aria-hidden="true">{evidenceOpen ? '−' : '+'}</span></button>
          <div id="iv-project-evidence" ref={evidencePanel} hidden={!evidenceOpen}>{evidenceOpen && <ProjectEvidence key={project.id} project={project} weights={board?.weights}/>}</div>
        </section>}
      </div>
  </section>;
}
