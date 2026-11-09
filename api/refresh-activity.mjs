import {timingSafeEqual} from 'node:crypto';
import {openDatabase} from '../services/store.mjs';
import {backfill} from '../services/historical.mjs';
import {bigQueryForInvocation} from '../services/bigquery.mjs';
import {ingestBlocks, ingestProjectSample} from '../services/nearblocks.mjs';
import {calculateRankings, rankingCutoff} from '../services/rankings.mjs';

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).end();
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(request.headers.authorization ?? '');
  const expected = Buffer.from('Bearer '+secret);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return response.status(401).json({error:'Unauthorized'});
  }
  let db, lock;
  try {
    db = openDatabase();
    lock = await db.connect();
    const {rows:[{acquired}]} = await lock.query('SELECT pg_try_advisory_lock(61398420) AS acquired');
    if (!acquired) return response.status(200).json({status:'already running'});
    const cutoff = rankingCutoff();
    const day = 86400000;
    const today = Math.floor(cutoff/day)*day;
    const date = time => new Date(time).toISOString().slice(0,10);
    await ingestBlocks(db);
    await ingestProjectSample(db);
    await backfill(db, date(today-2*day), date(today-day), bigQueryForInvocation(request.headers['x-vercel-oidc-token']));
    const result = await calculateRankings(db, cutoff);
    return response.status(200).json({status:'complete', cutoff:result.cutoff});
  } catch (error) {
    console.error('Activity refresh failed', error.message);
    return response.status(502).json({error:'Activity refresh failed. See function logs.'});
  } finally {
    // Closing this session releases the advisory lock even after an error.
    lock?.release(true);
    await db?.end();
  }
}
