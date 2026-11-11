import {warehouseActivityMethodology} from '../services/activity-eligibility.mjs';
import {openDatabase} from '../services/store.mjs';
import {discoverTokenCandidates, researchEcosystem, researchLeaderboard, researchNarratives, researchProject} from '../services/project-research.mjs';

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).end();
  const {view = 'leaderboard', id, cursor, page = '1', q = ''} = request.query;
  if (!['leaderboard','project','candidates','narratives','ecosystem'].includes(view)) return response.status(400).json({error:'Invalid view'});
  if (view === 'project' && (typeof id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(id))) {
    return response.status(400).json({error:'A valid project ID is required'});
  }
  if (cursor !== undefined && (view !== 'candidates' || typeof cursor !== 'string' || !/^[A-Za-z0-9_+/=-]{1,512}$/.test(cursor))) {
    return response.status(400).json({error:'Invalid cursor'});
  }
  if (view === 'ecosystem') {
    if (typeof page !== 'string' || !/^[1-9]\d{0,5}$/.test(page)) return response.status(400).json({error:'Invalid page'});
    if (typeof q !== 'string' || q.length > 100) return response.status(400).json({error:'Invalid search'});
    response.setHeader('Cache-Control','public, s-maxage=600');
    return response.status(200).json(researchEcosystem(Number(page),q.trim()));
  }
  let db;
  try {
    if (view === 'candidates' || view === 'narratives') {
      const result = view === 'candidates' ? await discoverTokenCandidates(cursor) : await researchNarratives();
      response.setHeader('Cache-Control','public, s-maxage=600');
      return response.status(200).json(result);
    }
    db = openDatabase();
    const {rows:[latest]} = await db.query(
      'SELECT results FROM invisible.ranking_run WHERE methodology=ANY($1::text[]) ORDER BY cutoff DESC LIMIT 1',
      [[warehouseActivityMethodology,'activity-warehouse-v4']]);
    const snapshot = latest?.results ?? null;
    const result = view === 'project' ? await researchProject(id, snapshot) : researchLeaderboard(snapshot);
    if (!result) return response.status(404).json({error:'Project not found'});
    response.setHeader('Cache-Control',view === 'project' ? 'public, s-maxage=300' : 'public, s-maxage=60');
    return response.status(200).json(result);
  } catch (error) {
    console.error('Research read failed', error.message);
    return response.status(503).json({error:'Research data is temporarily unavailable'});
  } finally {
    await db?.end();
  }
}
