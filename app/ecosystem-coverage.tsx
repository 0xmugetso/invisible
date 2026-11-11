'use client';

import {useEffect,useState} from 'react';

type Page = {
  total:number; nextPage:number|null;
  indexedMatches?:{id:string;name:string;accountId:string;source:string}[];
  projects:{id:string; name:string; status:string; reportedTokens?:{symbol:string;accountId:string}[];
    tokenScreen?:{review?:{reason:string;source:string}|null; nameMatches:{name:string;accountId:string;source:string}[]}; evidence:{source:string}[]}[];
};
const labels:Record<string,string> = {
  verified_registry:'Reviewed', unverified_token_lead:'Token lead needs verification', no_token_found_in_sources:'No token found in screened sources', excluded_standalone_meme:'Excluded · standalone meme', excluded_shared_asset:'Excluded · shared asset',
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
        {project.tokenScreen?.nameMatches.map(token=><a key={token.accountId} href={token.source}>Token name match · {token.name}</a>)}
        {project.tokenScreen?.review && <span>{project.tokenScreen.review.reason} <a href={project.tokenScreen.review.source}>Review source</a></span>}
        {project.evidence[0] && <a href={project.evidence[0].source}>Listing source</a>}
      </li>)}</ul>
      {!!data.indexedMatches?.length && <details>
        <summary>Matching indexed assets ({data.indexedMatches.length})</summary>
        <ul>{data.indexedMatches.map(token=><li key={token.id}><a href={token.source}>{token.name}</a> <span>{token.accountId}</span></li>)}</ul>
      </details>}
      {(page>1 || data.nextPage!==null) && <div className="catalog-pagination">
        <button type="button" disabled={page===1} onClick={()=>changePage(page-1)}>Previous</button>
        <span>Page {page}</span>
        <button type="button" disabled={data.nextPage===null} onClick={()=>changePage(page+1)}>Next</button>
      </div>}
    </> : <p role="status">{failed ? 'The ecosystem catalog is temporarily unavailable.' : 'Loading ecosystem listings…'}</p>}
  </div>;
}
