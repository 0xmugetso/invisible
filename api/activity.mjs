import {openDatabase} from '../services/store.mjs';
import {latestBlocks, latestProjectActivity} from '../services/rankings.mjs';

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).end();
  response.setHeader('Cache-Control','no-store');
  const {dataset} = request.query;
  if (dataset !== 'rankings' && dataset !== 'blocks' && dataset !== 'projects') return response.status(404).end();
  let db;
  try {
    db = openDatabase();
    if (dataset === 'blocks') {
      const blocks = await latestBlocks(db);
      if (!blocks.data.length || Date.now()-Number(BigInt(blocks.data[0].block_timestamp)/1000000n)>90000) {
        return response.status(503).end();
      }
      return response.status(200).json(blocks);
    }
    if (dataset === 'projects') return response.status(200).json(await latestProjectActivity(db));
    const {rows:[latest]} = await db.query('SELECT results FROM invisible.ranking_run ORDER BY cutoff DESC LIMIT 1');
    return latest ? response.status(200).json(latest.results) : response.status(404).end();
  } catch (error) {
    console.error('Activity read failed', error.message);
    return response.status(503).end();
  } finally {
    await db?.end();
  }
}
