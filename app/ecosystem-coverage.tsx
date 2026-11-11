'use client';

import {useEffect,useState} from 'react';

type Page = {
  total:number; nextPage:number|null;
  projects:{id:string; name:string; status:string; reportedTokens?:{symbol:string;accountId:string}[];
    evidence:{source:string}[]}[];
};
const labels:Record<string,string> = {
  verified_registry:'Reviewed', needs_product_review:'Review pending', excluded_standalone_meme:'Excluded · standalone meme', excluded_shared_asset:'Excluded · shared asset',
};

export default function EcosystemCoverage() {
  const [search,setSearch] = useState('');
  const [query,setQuery] = useState('');
  const [page,setPage] = useState(1);
  const [data,setData] = useState<Page|null>(null);
  const [failed,setFailed] = useState(false);
  useEffect(()=>{
    const controller = new AbortController();
    const params = new URLSearchParams({view:'ecosystem',page:String(page),q:query});
    fetch('/api/research?'+params,{signal:controller.signal}).then(response=>{
      if (!response.ok) throw new Error('Catalog unavailable');
      return response.json();
    }).then(setData).catch(()=>{if (!controller.signal.aborted) setFailed(true);});
    return ()=>controller.abort();
  },[page,query]);
  function changePage(next:number) {
    setData(null);
    setFailed(false);
    setPage(next);
  }
  return <div className="research-catalog">
    <form onSubmit={event=>{
      event.preventDefault();
      if (query===search.trim() && page===1) return;
      changePage(1);
      setQuery(search.trim());
    }}>
      <label htmlFor="ecosystem-search">Project or contract</label>
      <input id="ecosystem-search" value={search} onChange={event=>setSearch(event.target.value)} maxLength={100}/>
      <button type="submit">Search</button>
    </form>
    {data ? <>
      <p role="status">{data.total} matching listings</p>
      <ul>{data.projects.map(project=><li key={project.id}>
        <strong>{project.name}</strong>
        <span>{labels[project.status] ?? project.status}</span>
        {project.reportedTokens?.length ? <span>Reported tokens: {project.reportedTokens.map(token=>token.symbol).join(', ')}</span> : null}
        {project.evidence[0] && <a href={project.evidence[0].source}>Listing source</a>}
      </li>)}</ul>
      {(page>1 || data.nextPage!==null) && <div className="catalog-pagination">
        <button type="button" disabled={page===1} onClick={()=>changePage(page-1)}>Previous</button>
        <span>Page {page}</span>
        <button type="button" disabled={data.nextPage===null} onClick={()=>changePage(page+1)}>Next</button>
      </div>}
    </> : <p role="status">{failed ? 'The ecosystem catalog is temporarily unavailable.' : 'Loading ecosystem listings…'}</p>}
  </div>;
}
