import {openDatabase} from './store.mjs';
import {warehouseReadMethodologies} from './activity-eligibility.mjs';
import {investmentLeaderboard} from './investment-ranking.mjs';
import {researchEcosystem, researchForecast, researchLeaderboard, researchProject, researchProjectCore} from './project-research.mjs';

export async function readPublishedResearch(view, id) {
  const db = openDatabase();
  try {
    const {rows:[latest]} = await db.query(
      'SELECT results FROM invisible.ranking_run WHERE methodology=ANY($1::text[]) ORDER BY cutoff DESC LIMIT 1',
      [warehouseReadMethodologies]);
    const snapshot = latest?.results ?? null;
    if (view === 'project') return researchProject(id, snapshot);
    if (view === 'project-core') return researchProjectCore(id,snapshot);
    if (view === 'forecast') return researchForecast(snapshot);
    const leaderboard = researchLeaderboard(snapshot);
    return view === 'investment' ? investmentLeaderboard(leaderboard) : leaderboard;
  } finally {
    await db.end();
  }
}

export function findProjects(query, page=1) {
  return researchEcosystem(page, query.trim());
}

export async function returningSigners(limit=10) {
  const board = await readPublishedResearch('leaderboard');
  return {
    cutoff:board.cutoff, methodology:board.methodology,
    scope:'Verified-token projects with measured activity on attributed NEAR contracts',
    projects:board.projects.filter(project=>project.activity && project.activityRank!=null)
      .sort((a,b)=>b.activity.repeat_signers-a.activity.repeat_signers || a.id.localeCompare(b.id)).slice(0,limit)
      .map(({id,name,activity})=>({
        id,name, returningSigners:activity.repeat_signers, latestSigners:activity.current_signers, previousSigners:activity.prior_signers,
        transactions:activity.evidence.map(hash=>'https://nearblocks.io/txns/'+hash),
        evidence:'/api/v1/projects/'+id,
      })),
  };
}
