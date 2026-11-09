'use client';

import {useEffect, useState} from 'react';

type RankingRelease = {id:string; observed:string; deployments:string; report:string};

export function useRankingRelease() {
  const [release, setRelease] = useState<RankingRelease | null>(null);
  useEffect(() => {
    let request: AbortController | undefined;
    async function check() {
      if (document.hidden || request) return;
      const controller = new AbortController();
      request = controller;
      try {
        const response = await fetch('/rankings/current.json', {
          cache: 'no-cache',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if (!response.ok) return;
        const {id} = await response.json();
        if (controller.signal.aborted || typeof id !== 'string' || !/^\d{4}-\d{2}-\d{2}-[a-f0-9]{12}$/.test(id)) return;
        const base = '/rankings/' + id;
        setRelease(previous => previous?.id === id ? previous : {
          id, observed: base + '/observed.json', deployments: base + '/deployments.json', report: base + '/thesis-observed.md',
        });
      } catch {
        // Keep the current ranking during an outage.
      } finally {
        request = undefined;
      }
    }
    void check();
    const interval = window.setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    return () => {
      request?.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return release;
}
