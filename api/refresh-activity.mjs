import {timingSafeEqual} from 'node:crypto';
import {openDatabase} from '../services/store.mjs';
import {backfill} from '../services/historical.mjs';
import {bigQueryForInvocation} from '../services/bigquery.mjs';
import {ingestBlocks, ingestProjectSample} from '../services/nearblocks.mjs';
import {calculateRankings, rankingCutoff} from '../services/rankings.mjs';

const day = 86400000;
const date = time => new Date(time).toISOString().slice(0,10);

export default async function handler(request, response) {
  const historical = request.method === 'POST';
  if (!historical && request.method !== 'GET') return response.status(405).end();
  response.setHeader('Cache-Control','no-store');
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(request.headers.authorization ?? '');
  const expected = Buffer.from('Bearer '+secret);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return response.status(401).json({error:'Unauthorized'});
  }
  const {start, end} = request.query;
  if (historical) {
    const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) && date(Date.parse(value)) === value;
    if (!validDate(start) || !validDate(end) || start >= end ||
        end >= date(Date.now()) || Date.parse(end)-Date.parse(start) > 7*day) {
      return response.status(400).json({error:'Pass a UTC date range of at most seven days, ending before today.'});
    }
  }
  let db, lock;
  try {
    db = openDatabase();
    lock = await db.connect();
    const {rows:[{acquired}]} = await lock.query('SELECT pg_try_advisory_lock(61398420) AS acquired');
    if (!acquired) return response.status(historical ? 409 : 200).json({status:'already running'});
    const query = bigQueryForInvocation(request.headers['x-vercel-oidc-token']);
    if (historical) {
      const result = await backfill(db, start, end, query, {skipUnavailable:true});
      return response.status(200).json(result);
    }
    const cutoff = rankingCutoff();
    const today = Math.floor(cutoff/day)*day;
    await ingestBlocks(db);
    await ingestProjectSample(db);
    await backfill(db, date(today-2*day), date(today-day), query);
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
