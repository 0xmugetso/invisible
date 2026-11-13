'use client';
import DataSkeleton from './data-skeleton';

import ProjectMark from './project-mark';
import Icon from './interface-icon';
import ProjectPagination from './project-pagination';
import {useState} from 'react';
import {ProjectEvidenceDialog} from './project-evidence';
import {useResearchBoard} from './use-research-board';

const status:Record<string,string> = {
  reference:'Reference project', below_ranking_thresholds:'Below activity thresholds',
  awaiting_measurement:'Waiting for mapped activity', awaiting_comparable_cohort:'Waiting for a comparable cohort',
  unattributed_activity:'Product activity unattributed',
};
const investmentStatus:Record<string,string> = {
  activity_ineligible:'Activity criteria unmet', primary_token_required:'Primary token evidence needed',
  market_source_unavailable:'Pool data unavailable', pool_evidence_missing:'No qualifying pool in source',
  valuation_evidence_missing:'Market cap or FDV evidence missing', insufficient_comparable_projects:'Comparable cohort too small',
};
const num = new Intl.NumberFormat('en-US');
const money = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2});
const format = (value:number|null|undefined) => value == null ? '—' : num.format(value);
const percent = (value:number|null|undefined) => value == null ? '—' : (value > 0 ? '+' : '')+Math.round(value*100)+'%';

export default function ActivityRankings() {
  const {board, failed} = useResearchBoard();
  const [selectedView,setView] = useState<'investment'|'activity'|'unranked'|null>(null);
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [query,setQuery] = useState('');
  const [page,setPage] = useState(0);
  const pageSize = 8;
  if (!board) return failed ? <p className="research-loading" role="status">Rankings are temporarily unavailable. This page retries every minute.</p> : <DataSkeleton label="Loading verified projects"/>;
  const view=selectedView ?? (board.marketCheckedAt ? 'investment' : 'activity');
  const ranked = board.projects.filter(project=>project.activityRank!==null)
    .sort((a,b)=>a.activityRank!-b.activityRank!);
  const investment = board.projects.filter(project=>project.performanceRank!==null)
    .sort((a,b)=>a.performanceRank!-b.performanceRank!);
  const unranked = board.projects.filter(project=>project.performanceRank===null);
  const tabs = [
    {id:'investment',label:'Investment',icon:'ranking',items:investment},
    {id:'activity',label:'Activity',icon:'observed',items:ranked},
    {id:'unranked',label:'No investment rank',icon:'contracts',items:unranked},
  ] as const;
  const active = tabs.find(tab=>tab.id===view)!;
  const needle = query.trim().toLowerCase();
  const projects = active.items.filter(project=>[project.name,...project.tokens.map(token=>token.symbol)].some(name=>name.toLowerCase().includes(needle)));
  const selected = board.projects.find(project=>project.id===selectedId);
  const currentPage = Math.max(0,Math.min(page,Math.ceil(projects.length/pageSize)-1));
  const visible = projects.slice(currentPage*pageSize,(currentPage+1)*pageSize);
  const lastDay = board.cutoff ? new Date(Date.parse(board.cutoff)-1).toISOString().slice(0,10) : null;
  return <section className="iv-card iv-observed iv-ready-fade" aria-label="Project rankings">
    <div className="iv-observed-head">
      <div><h2>Verified-Token Leaderboard</h2><p>{lastDay ? `Activity through ${lastDay} UTC` : 'Activity snapshot pending'}{failed ? ' · Last available snapshot' : ''}</p></div>
      <label className="iv-find"><Icon name="search"/><input aria-label="Search projects or symbols" placeholder="Search name or symbol" value={query} onChange={event=>{setQuery(event.target.value);setPage(0);setSelectedId(null);}}/></label>
    </div>
    <div className="iv-observed-tools">
      <div className="iv-switch" aria-label="Ranking status">
        {tabs.map(tab=><button type="button" key={tab.id} disabled={tab.id==='investment' && !board.marketCheckedAt} aria-pressed={view===tab.id} onClick={()=>{setView(tab.id);setPage(0);setSelectedId(null);}}>
          <Icon name={tab.icon}/>{tab.label} <span>{tab.items.length}</span>
        </button>)}
      </div>
      {view==='investment' && <a className="iv-text-link" href="/docs/#investment-methodology">How the score works <Icon name="launch"/></a>}
    </div>
    {visible.length ? <div className="iv-observed-scroll"><table>
      <thead><tr><th scope="col">Project</th><th scope="col">28-day signers</th><th scope="col">Previous signers who returned</th><th scope="col" className="iv-market-column">NEAR market</th><th scope="col">{view==='unranked' ? 'Eligibility' : 'Score'}</th></tr></thead>
      {visible.map(project=>{
        const {activity,market} = project;
        const rate = activity?.prior_signers ? activity.repeat_signers/activity.prior_signers : null;
        const score = view==='activity' ? project.activityScore : project.performanceScore;
        const rank = view==='activity' ? project.activityRank : project.performanceRank;
        const reason = project.activityRank===null ? status[project.status] : investmentStatus[project.investmentStatus];
        return <tbody key={project.id}>
          <tr>
            <th scope="row">
              <button className="iv-project-cell" type="button" aria-haspopup="dialog"
                onClick={event=>{event.currentTarget.focus({preventScroll:true});setSelectedId(project.id);}}>
                {rank!=null && <span className="iv-observed-rank">{rank}</span>}
                <ProjectMark id={project.id}/><span>{project.name}<small>{project.tokens.map(token=>token.symbol).join(', ')}</small></span>
                <Icon name="right"/>
              </button>
            </th>
            <td><strong>{format(activity?.current_signers)}</strong>{activity?.monthly_growth!=null && <small>{percent(activity.monthly_growth)} vs prior</small>}</td>
            <td><strong>{rate==null ? '—' : Math.round(rate*100)+'%'}</strong>{activity && <small>{format(activity.repeat_signers)} accounts</small>}</td>
            <td className="iv-market-column"><strong>{market ? money.format(market.liquidityUsd) : '—'}</strong>{market && <small>Pool Reserves{project.circulatingShare!=null && ` · ${Math.round(project.circulatingShare*100)}% cap/FDV`}</small>}</td>
            <td>{view==='unranked' ? <small className="iv-eligibility">{reason ?? 'Evidence pending'}</small> : <div className="iv-observed-score">
              <strong>{format(score)} <small>/ 100</small></strong>
              {score!=null && <div className="iv-score-track" aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(score,100))}%`}}/></div>}
            </div>}</td>
          </tr>
        </tbody>;
      })}
    </table></div> : <p className="ranking-empty">{needle ? 'No projects match your search.' : view==='investment' && board.performanceRankingStatus==='market_source_unavailable'
      ? 'Pool data is temporarily unavailable. Activity rankings are available.' : 'No projects in this view.'}</p>}
    <ProjectPagination page={currentPage} pageSize={pageSize} total={projects.length} onPageChange={next=>{setPage(next);setSelectedId(null);}}/>
    {selected && <ProjectEvidenceDialog key={selected.id} projectId={selected.id} market={selected.market} weights={board.weights} onDismiss={()=>setSelectedId(null)}/>}
    <p className="iv-observed-foot">{format(board.coverage.catalogEntries)} ecosystem listings screened · {format(board.coverage.tokenLeads)} token leads to verify <a href="#project-registry">Browse coverage</a></p>
  </section>;
}
