import {discoverTokenCandidates, researchEcosystem, researchNarratives, researchProjectMarket} from '../services/project-research.mjs';
import {readPublishedResearch} from '../services/research-read.mjs';

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).end();
  const {view = 'leaderboard', id, cursor, page = '1', q = ''} = request.query;
  if (!['leaderboard','investment','project','project-core','project-market','candidates','narratives','ecosystem','forecast'].includes(view)) return response.status(400).json({error:'Invalid view'});
  if (['project','project-core','project-market'].includes(view) && (typeof id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(id))) {
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
  try {
    if (view === 'project-market') {
      const result=await researchProjectMarket(id);
      if (!result) return response.status(404).json({error:'Project not found'});
      response.setHeader('Cache-Control','public, max-age=30, s-maxage=300, stale-while-revalidate=600');
      return response.status(200).json(result);
    }
    if (view === 'candidates' || view === 'narratives') {
      const result = view === 'candidates' ? await discoverTokenCandidates(cursor) : await researchNarratives();
      response.setHeader('Cache-Control','public, s-maxage=600');
      return response.status(200).json(result);
    }
    const result = await readPublishedResearch(view,id);
    if (!result) return response.status(404).json({error:'Project not found'});
    response.setHeader('Cache-Control',view.startsWith('project') ? 'public, max-age=30, s-maxage=300, stale-while-revalidate=600' : 'public, max-age=15, s-maxage=60, stale-while-revalidate=180');
    return response.status(200).json(result);
  } catch (error) {
    console.error('Research read failed', error.message);
    return response.status(503).json({error:'Research data is temporarily unavailable'});
  }
}
