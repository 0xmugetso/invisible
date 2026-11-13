'use client';

import {useState} from 'react';
import registry from '../data/activity-registry.json';
import EcosystemCoverage from './ecosystem-coverage';
import {ProjectEvidenceDialog} from './project-evidence';
import Icon from './interface-icon';
import ProjectMark from './project-mark';
import ProjectPagination from './project-pagination';

const reviewed = registry.map(project=>({...project,contractEntries:Object.entries(project.contracts) as [string,string][]}));
const verifiedCount = reviewed.filter(project=>project.tokens.length>0).length;
const unmappedCount = reviewed.filter(project=>project.contractEntries.length===0).length;
const unmappedVerified = reviewed.filter(project=>project.tokens.length>0 && project.contractEntries.length===0).length;
const contractCount = new Set(reviewed.flatMap(project=>project.contractEntries.map(([account])=>account))).size;
const pageSize = 8;
export default function ProjectCoverage() {
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState<'all'|'verified'|'unmapped'>('all');
  const [page,setPage] = useState(0);
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [catalogOpen,setCatalogOpen] = useState(false);
  const needle = query.trim().toLowerCase();
  const matching = reviewed.filter(project=>(filter==='all' || (filter==='verified' ? project.tokens.length>0 : project.contractEntries.length===0)) &&
    [project.name,project.category,...project.tokens.map(token=>token.symbol),...project.contractEntries.map(([account])=>account)]
      .some(value=>value.toLowerCase().includes(needle)));
  const visible = matching.slice(page*pageSize,(page+1)*pageSize);
  const selected = reviewed.find(project=>project.id===selectedId);
  const filters = [
    {id:'all',label:'All reviewed',icon:'overview',count:reviewed.length},
    {id:'verified',label:'Verified token',icon:'check',count:verifiedCount},
    {id:'unmapped',label:'Needs mapping',icon:'contracts',count:unmappedCount},
  ] as const;

  return <section id="project-registry" className="iv-card iv-contract-directory iv-project-coverage" aria-labelledby="iv-project-coverage-title">
    <div className="iv-observed-head">
      <div><h2 id="iv-project-coverage-title">Project coverage</h2><p>{reviewed.length-unmappedCount} of {reviewed.length} reviewed projects mapped · {contractCount} distinct contracts</p></div>
      <label className="iv-find"><Icon name="search"/><input aria-label="Find a reviewed project" placeholder="Find a reviewed project" value={query}
        onChange={event=>{setQuery(event.target.value);setPage(0);setSelectedId(null);}}/></label>
    </div>
    <div className="iv-observed-tools">
      <div className="iv-switch" aria-label="Project coverage filter">
        {filters.map(tab=><button key={tab.id} type="button" aria-pressed={filter===tab.id} onClick={()=>{setFilter(tab.id);setPage(0);setSelectedId(null);}}><Icon name={tab.icon}/>{tab.label} {tab.count}</button>)}
      </div>
      <span>{unmappedVerified} verified-token projects await contract attribution</span>
    </div>
    {visible.length ? <ul className="iv-coverage-rows">
      {visible.map(entry=><li key={entry.id}>
        <button type="button" aria-haspopup="dialog" onClick={event=>{event.currentTarget.focus({preventScroll:true});setSelectedId(entry.id);}}>
          <span className="iv-coverage-name"><ProjectMark id={entry.id}/><span><strong>{entry.name}</strong><small>{entry.category}</small></span></span>
          <span><strong>{entry.contractEntries.length}</strong><small>Mapped contracts</small></span>
          <span><strong>{entry.tokens.map(token=>token.symbol).join(', ') || '—'}</strong><small>{entry.tokens.length ? 'Verified token' : 'Research only'}</small></span>
          <Icon name="right"/>
        </button>

      </li>)}
    </ul> : <p className="ranking-empty">No reviewed projects match this search.</p>}
    <ProjectPagination label="Reviewed projects" page={page} pageSize={pageSize} total={matching.length} onPageChange={next=>{setPage(next);setSelectedId(null);}}/>
    {selected && <ProjectEvidenceDialog key={selected.id} projectId={selected.id} onDismiss={()=>setSelectedId(null)}/>}
    <details className="iv-coverage-catalog" onToggle={event=>setCatalogOpen(event.currentTarget.open)}>
      <summary>Search the wider ecosystem catalog</summary>{catalogOpen && <EcosystemCoverage/>}
    </details>
  </section>;
}
