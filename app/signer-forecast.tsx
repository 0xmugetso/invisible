'use client';
import DataSkeleton from './data-skeleton';

import {useEffect,useState} from 'react';
import Icon from './interface-icon';
import ProjectMark from './project-mark';
import {getResearch} from './use-research-board';

type Scenario = {
  id:string; name:string; previous:number; latest:number; overlap:number;
  forecast:{total:number; returning:number; other:number};
  backtest:{forecast:number; baseline:number; actual:number}|null;
  contracts:string[]; evidence:string|null;
};
type Forecast = {cutoff:string|null;source:string;projects:Scenario[]};
const format = new Intl.NumberFormat('en-US');
const signed = new Intl.NumberFormat('en-US',{signDisplay:'exceptZero'});
const utc = (date:number) => new Date(date).toISOString().slice(0,10);
const day = 86_400_000;
const warehouse = 'https://github.com/near/near-public-lakehouse';

export default function SignerForecast({projectId}:{projectId?:string}) {
  const [query,setQuery]=useState('');
  const [board,setBoard]=useState<Forecast|null>(null);
  const [failed,setFailed]=useState(false);
  const [selection,setSelection]=useState(projectId==='ref' || projectId==='burrow' ? 'rhea' : projectId ?? '');
  useEffect(()=>{
    const controller=new AbortController();
    getResearch<Forecast>({view:'forecast'},controller.signal).then(setBoard).catch(()=>{
      if (!controller.signal.aborted) setFailed(true);
    });
    return ()=>controller.abort();
  },[]);
  if (!board) return failed ? <p role="status" className="iv-card iv-forecast-status">The forecast data is temporarily unavailable.</p> : <DataSkeleton variant="cards" label="Loading measured signer cohorts"/>;
  if (!board.cutoff || !board.projects.length) return <p role="status" className="iv-card iv-forecast-status">A forecast needs two complete 28-day windows on the same mapped contracts.</p>;
  const selected=board.projects.find(project=>project.id===selection) ?? board.projects[0];
  const missingSelection=selection!=='' && selected.id!==selection;
  const {previous,latest,overlap,forecast,backtest}=selected;
  const cohortError=backtest ? Math.abs(backtest.forecast-backtest.actual) : null;
  const baselineError=backtest ? Math.abs(backtest.baseline-backtest.actual) : null;
  const cutoff=Date.parse(board.cutoff);
  const maximum=Math.max(previous,latest,forecast.total,1);
  const rows=[
    {label:'Previous 28 days',value:previous},
    {label:'Latest 28 days',value:latest},
    {label:'Flat baseline',value:latest},
    {label:'Cohort forecast',value:forecast.total},
  ];
  const rate=new Intl.NumberFormat('en-US',{style:'percent',maximumFractionDigits:1}).format(overlap/previous);
  return <div className="iv-forecast iv-ready-fade">
    <section className="iv-card iv-forecast-panel" aria-label="28-day signer forecast">
      <div className="iv-forecast-head">
        <div className="iv-forecast-project"><ProjectMark id={selected.id}/><div><h2>{selected.name}</h2><p>{selected.contracts.length} mapped {selected.contracts.length===1 ? 'contract' : 'contracts'} · Observed through {utc(cutoff-day)} UTC</p></div></div>
      </div>
      <div className="iv-forecast-picker">
        <label className="iv-find"><Icon name="search"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a project" aria-label="Find a forecast project"/></label>
        <div className="iv-forecast-options" role="group" aria-label="Forecast projects">
          {board.projects.filter(project=>project.name.toLowerCase().includes(query.trim().toLowerCase())).map(project=>
            <button type="button" key={project.id} aria-pressed={selected.id===project.id} onClick={()=>setSelection(project.id)}><ProjectMark id={project.id}/>{project.name}</button>)}
          {!board.projects.some(project=>project.name.toLowerCase().includes(query.trim().toLowerCase())) && <p>No projects match.</p>}
        </div>
      </div>
      {missingSelection && <p className="iv-evidence-muted">A comparable forecast is unavailable for the requested project. Showing {selected.name}.</p>}
      <div className="iv-forecast-grid">
        <div className="iv-forecast-plot">
          <h3>Distinct Signers</h3>
          {rows.map(({label,value},index)=><div className="iv-forecast-row" key={label} data-projected={index===3}>
            <span>{label}</span><strong>{format.format(value)}</strong>
            <div aria-hidden="true"><i style={{width:(100*value/maximum)+'%'}}/></div>
          </div>)}
        </div>
        <div className="iv-forecast-reading">
          <span>{utc(cutoff)} to {utc(cutoff+27*day)} UTC</span>
          <strong>{format.format(forecast.total)}</strong>
          <p>Cohort scenario · {signed.format(forecast.total-latest)} vs. the latest window</p>
          <dl><div><dt>Expected to return</dt><dd>{format.format(forecast.returning)}</dd></div><div><dt>Absent from the preceding window</dt><dd>{format.format(forecast.other)}</dd></div></dl>
        </div>
      </div>
    </section>
    <div className="iv-forecast-notes">
      <section className="iv-card iv-forecast-note">
        <h3><Icon name="observed"/> Assumptions</h3>
        <p>{rate} of the previous window’s signers appeared again. Applying that rate to the latest cohort gives the expected returners. The model carries forward the count of signers who appeared only in the latest window. The flat baseline simply repeats the latest total.</p>
        {Math.min(previous,latest)<50 && <p className="iv-evidence-muted">Small cohorts can swing sharply when a few accounts change behavior.</p>}
        <div className="iv-dialog-links"><a href={board.source || warehouse}>NEAR data source <Icon name="launch"/></a>{selected.evidence && <a href={'https://nearblocks.io/txns/'+selected.evidence}>Example transaction <Icon name="launch"/></a>}</div>
      </section>
      <section className="iv-card iv-forecast-note">
        <h3><Icon name="research"/> Historical Check</h3>
        {backtest ? <>
          <p>Using the two earlier windows to predict the latest, the cohort model estimated <strong>{format.format(backtest.forecast)}</strong> signers. We measured <strong>{format.format(backtest.actual)}</strong>.</p>
          <dl className="iv-forecast-errors"><div><dt>Cohort model error</dt><dd>{format.format(cohortError!)} signers</dd></div><div><dt>Flat baseline error</dt><dd>{format.format(baselineError!)} signers</dd></div></dl>
          <p className="iv-evidence-muted">{baselineError!<cohortError! ? 'The flat baseline was closer in this check.' : cohortError!<baselineError! ? 'The cohort model was closer in this check.' : 'Both estimates were equally close in this check.'} One window gives a rough view of accuracy.</p>
        </> : <p>A third complete window with a nonzero starting cohort is required for a historical check.</p>}
      </section>
    </div>
  </div>;
}
