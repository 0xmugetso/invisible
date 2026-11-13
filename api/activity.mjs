import {openDatabase} from '../services/store.mjs';
import {latestBlocks, latestProjectActivity, rankingCoverage} from '../services/rankings.mjs';

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).end();
  response.setHeader('Cache-Control','no-store');
  const {dataset} = request.query;
  if (!['rankings','blocks','projects','coverage','contract'].includes(dataset)) return response.status(404).end();
  let db;
  try {
    const contract=request.query.contract;
    if (dataset==='contract' && (typeof contract!=='string' || !/^[a-z0-9._-]{2,64}$/.test(contract))) return response.status(400).end();
    db = openDatabase();
    if (dataset==='contract') {
      const {rows}=await db.query(`SELECT transaction_hash, receiver_id AS receiver_account_id, methods, succeeded, block_time
        FROM invisible.direct_call WHERE receiver_id=$1 ORDER BY block_time DESC LIMIT 5`,[contract]);
      response.setHeader('Cache-Control','public, max-age=300, s-maxage=900');
      return response.status(200).json({checkedAt:rows[0]?.block_time ?? null,data:rows.map(row=>({...row,actions:row.methods.map(method=>({method})),outcomes:{status:row.succeeded}}))});
    }
    if (dataset === 'blocks') {
      const blocks = await latestBlocks(db);
      if (!blocks.data.length) {
        return response.status(503).end();
      }
      response.setHeader('Cache-Control','public, max-age=300, s-maxage=900');
      return response.status(200).json(blocks);
    }
    if (dataset === 'projects') return response.status(200).json(await latestProjectActivity(db));
    if (dataset === 'coverage') return response.status(200).json(await rankingCoverage(db));
    const {rows:[latest]} = await db.query('SELECT results FROM invisible.ranking_run ORDER BY cutoff DESC LIMIT 1');
    return latest ? response.status(200).json(latest.results) : response.status(404).end();
  } catch (error) {
    console.error('Activity read failed', error.message);
    return response.status(503).end();
  } finally {
    await db?.end();
  }
}
