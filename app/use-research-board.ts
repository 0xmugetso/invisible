'use client';

import {useEffect, useState} from 'react';

export type ResearchProject = {
  id:string; name:string; status:string; activityRank:number|null; activityScore:number|null;
  tokens:{symbol:string; accountId:string; evidence:string}[];
  activity:{current_signers:number; prior_signers:number; repeat_signers:number; monthly_growth:number|null; evidence:string[]} | null;
  performanceRank:number|null; performanceScore:number|null; investmentStatus:string;
  market:{liquidityUsd:number; source:string; fdvUsd:number|null; marketCapUsd:number|null; volume24hUsd:number|null}|null;
  circulatingShare:number|null;
  investmentComponents?:Record<string,number>|null;
  scoreComponents?:Record<string,number>|null;
  unmetThresholds:{metric:string; minimum:number; observed:number|null}[];
};
export type ResearchBoard = {cutoff:string|null; marketCheckedAt?:string; investmentWeights?:Record<string,number>; performanceRankingStatus?:string; weights?:Record<string,number>|null; coverage:{catalogEntries:number;tokenLeads:number;noTokenEvidence:number}; projects:ResearchProject[]};

export async function getResearch<T>(params:Record<string,string>, signal:AbortSignal):Promise<T> {
  const response = await fetch('/api/research?'+new URLSearchParams(params),{signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])});
  if (!response.ok) throw new Error('Research data unavailable');
  return response.json();
}

let cachedBoard:ResearchBoard|null = null;
let fetchedAt = 0;

export function useResearchBoard() {
  const [board,setBoard] = useState<ResearchBoard|null>(()=>cachedBoard);
  const [failed,setFailed] = useState(false);
  useEffect(()=>{
    const controller = new AbortController();
    let pending = false;
    const load = async () => {
      if (pending || document.hidden || Date.now()-fetchedAt<60_000) return;
      pending = true;
      try {
        const result = await getResearch<ResearchBoard>({view:'investment'},controller.signal).catch(error=>{
          if (cachedBoard || controller.signal.aborted) throw error;
          return getResearch<ResearchBoard>({view:'leaderboard'},controller.signal);
        });
        if (!controller.signal.aborted) {
          cachedBoard=result;
          fetchedAt=Date.now();
          setBoard(result);
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        pending = false;
      }
    };
    void load();
    const interval = window.setInterval(load,60000);
    document.addEventListener('visibilitychange',load);
    return ()=>{controller.abort();window.clearInterval(interval);document.removeEventListener('visibilitychange',load);};
  },[]);
  return {board, failed};
}
