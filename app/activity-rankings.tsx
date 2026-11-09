'use client';

import {useEffect, useState} from 'react';

type Recommendation = {
  project_id:string; name:string; score:number; active_days:number;
  monthly_growth:number; weekly_growth:number; returning_share:number;
  evidence:string[]; tokens:{symbol:string; account:string; evidence:string}[];
  links:{kind:string; url:string}[] | null;
};
type Rankings = {cutoff:string; highestRanked:Recommendation[]; fastestRising:Recommendation[]};
const percent = (value:number) => Math.round(value*100)+'%';
const growth = (value:number) => (value > 0 ? '+' : '')+percent(value);

export default function ActivityRankings() {
  const [ranking, setRanking] = useState<Rankings|null>(null);
  useEffect(() => {
    let request: AbortController | undefined;
    async function refresh() {
      if (document.hidden || request) return;
      const controller = new AbortController();
      request = controller;
      try {
        const response = await fetch('/activity/rankings.json', {
          cache:'no-cache', signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]),
        });
        if (!response.ok) return;
        const value: Rankings = await response.json();
        if (!controller.signal.aborted && Array.isArray(value.highestRanked) && Array.isArray(value.fastestRising)) {
          setRanking(previous => previous?.cutoff === value.cutoff ? previous : value);
        }
      } catch {
        // Retain the last published rankings.
      } finally {
        request = undefined;
      }
    }
    void refresh();
    const interval = window.setInterval(refresh,60000);
    document.addEventListener('visibilitychange',refresh);
    return () => {
      request?.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange',refresh);
    };
  }, []);

  return <section className="panel activity-recommendations">
    <h2>Projects to watch</h2>
    {ranking ? <>
      <p>Verified NEAR tokens · Activity through {ranking.cutoff.slice(0,16).replace('T',' ')} UTC</p>
      <div className="columns">
        {([['Highest ranked',ranking.highestRanked],['Fastest rising',ranking.fastestRising]] as const).map(([title,projects])=>
          <div key={title}>
            <h3>{title}</h3>
            {projects.length ? <ol>{projects.map(project=><li key={project.project_id}>
              <strong>{project.name}</strong> · {project.tokens.map(token=><a key={token.account} href={token.evidence}>{token.symbol}</a>)}
              <p>{title === 'Highest ranked'
                ? `Score ${project.score}/100 · ${percent(project.returning_share)} of prior signers returned · ${growth(project.monthly_growth)} 28-day signer growth · active on ${project.active_days} of 28 days`
                : `${growth(project.weekly_growth)} active signers compared with the previous seven days`}</p>
              <p>{project.evidence[0] && <a href={'https://nearblocks.io/txns/'+project.evidence[0]}>Example transaction ↗</a>}
                {project.links?.map(link=><a key={link.kind+link.url} href={link.url}> · {link.kind}</a>)}</p>
            </li>)}</ol> : <p>No eligible projects grew over the latest seven days.</p>}
          </div>)}
      </div>
    </> : <p>Rankings will appear after the first complete history import and scoring run.</p>}
  </section>;
}
