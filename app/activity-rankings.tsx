'use client';

import {useEffect, useState} from 'react';

type Recommendation = {
  project_id:string; name:string; score:number; active_days:number;
  monthly_growth:number; weekly_growth:number; returning_share:number;
  evidence:string[]; tokens:{symbol:string; account:string; evidence:string}[];
};
type RecentCall = {
  id:string; name:string; transaction_hash:string; receiver_id:string; block_time:string;
  methods:string[]; succeeded:boolean|null;
};
type Rankings = {cutoff:string; registryVersion?:string; analysis?:unknown[]; highestRanked:Recommendation[]; fastestRising:Recommendation[]};
type Coverage = {coveredDays:number; totalDays:number; contracts:number; cutoff:string};
const percent = (value:number) => Math.round(value*100)+'%';
const growth = (value:number) => (value > 0 ? '+' : '')+percent(value);

export default function ActivityRankings() {
  const [ranking, setRanking] = useState<Rankings|null>(null);
  const [list, setList] = useState<'highestRanked'|'fastestRising'>('highestRanked');
  const [recent, setRecent] = useState<RecentCall[]>([]);
  const [coverage, setCoverage] = useState<Coverage|null>(null);
  const [coverageChecked, setCoverageChecked] = useState(false);
  useEffect(() => {
    let request: AbortController | undefined;
    async function refresh() {
      if (document.hidden || request) return;
      const controller = new AbortController();
      request = controller;
      try {
        const options = {cache:'no-cache', signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])} as const;
        const [ranked, sampled, measured] = await Promise.allSettled(
          ['rankings','projects','coverage'].map(async dataset => {
            const response = await fetch('/activity/'+dataset+'.json', options);
            return response.ok ? response.json() : null;
          })
        );
        if (controller.signal.aborted) return;
        if (ranked.status === 'fulfilled' && ranked.value) {
          const value: Rankings = ranked.value;
          if (Array.isArray(value.highestRanked) && Array.isArray(value.fastestRising)) {
            setRanking(previous => previous?.cutoff === value.cutoff && previous.registryVersion === value.registryVersion ? previous : value);
          }
        }
        if (sampled.status === 'fulfilled' && Array.isArray(sampled.value)) setRecent(sampled.value);
        const value: Coverage | null = measured.status === 'fulfilled' ? measured.value : null;
        setCoverage(value && Number.isInteger(value.coveredDays) && value.totalDays > 0 &&
          value.coveredDays >= 0 && value.coveredDays <= value.totalDays ? value : null);
        setCoverageChecked(true);
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
    {ranking ? <>
      <div className="ranking-tools">
        <div className="ranking-switch" aria-label="Project ranking">
          <button type="button" aria-pressed={list === 'highestRanked'} onClick={()=>setList('highestRanked')}>Highest ranked</button>
          <button type="button" aria-pressed={list === 'fastestRising'} onClick={()=>setList('fastestRising')}>Fastest rising</button>
        </div>
        <p>{ranking.analysis?.length ?? ranking.highestRanked.length} projects measured · Cutoff {ranking.cutoff.slice(0,10)} UTC</p>
      </div>
      {ranking[list].length ? <ol className="project-leaderboard">
        {ranking[list].map((project,index)=><li key={project.project_id}>
          <span className="leader-index">{String(index+1).padStart(2,'0')}</span>
          <div className="leader-name"><strong>{project.name}</strong>
            <div>{project.tokens.map(token=><a key={token.account} href={token.evidence}>{token.symbol} ↗</a>)}
              {project.evidence[0] && <a href={'https://nearblocks.io/txns/'+project.evidence[0]}>Example transaction ↗</a>}
            </div>
          </div>
          <div className="leader-metric"><strong>{growth(list === 'highestRanked' ? project.monthly_growth : project.weekly_growth)}</strong><small>{list === 'highestRanked' ? '28-day signer growth' : '7-day signer growth'}</small></div>
          <div className="leader-metric"><strong>{percent(project.returning_share)}</strong><small>Prior signers returned</small></div>
          <div className="leader-metric leader-score"><strong>{project.score}</strong><small>Score / 100</small></div>
        </li>)}
      </ol> : <p className="ranking-empty">{list === 'highestRanked'
        ? 'At least three projects must meet the signer thresholds to publish a ranking.'
        : 'No ranked projects gained signers over the latest seven days.'}</p>}
    </> : <>
      <div className="ranking-coverage">
        <div className="ranking-coverage-label">
          <h3>Ranking data coverage</h3>
          {coverage && <span>{coverage.coveredDays} / {coverage.totalDays} days</span>}
        </div>
        {coverage ? <>
          <progress aria-label="Ranking data coverage" value={coverage.coveredDays} max={coverage.totalDays} />
          <p>{coverage.coveredDays === coverage.totalDays
            ? 'Coverage complete. Rankings are pending.'
            : `${coverage.totalDays - coverage.coveredDays} of ${coverage.totalDays} days still need coverage.`}</p>
        </> : <p>{coverageChecked ? 'Coverage data is unavailable.' : 'Checking data coverage…'}</p>}
      </div>
      {recent.length > 0 && <>
        <h3>Latest calls from verified projects</h3>
        <ul className="project-pulse">
          {recent.map(call => <li key={call.id}>
            <div><strong>{call.name}</strong><p>{call.methods[0] ?? 'Function call'} · {call.succeeded === true ? 'Succeeded' : call.succeeded === false ? 'Failed' : 'Status unknown'}</p></div>
            <div><time dateTime={call.block_time}>{call.block_time.slice(0,16).replace('T',' ')} UTC</time>
              <a href={'https://nearblocks.io/txns/'+call.transaction_hash}>View transaction ↗</a></div>
          </li>)}
        </ul>
      </>}
    </>}
  </section>;
}
