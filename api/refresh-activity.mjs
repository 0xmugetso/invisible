import {timingSafeEqual} from 'node:crypto';
import {openDatabase, seedRegistry} from '../services/store.mjs';
import {bigQueryForInvocation} from '../services/bigquery.mjs';
import {ingestBlocks, ingestProjectSample} from '../services/nearblocks.mjs';
import {refreshWarehouseRankings} from '../services/warehouse-rankings.mjs';

const day = 86400000;
const date = time => new Date(time).toISOString().slice(0,10);

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).end();
  response.setHeader('Cache-Control','no-store');
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
    await seedRegistry(db);
    const query = bigQueryForInvocation(request.headers['x-vercel-oidc-token']);
    const today = date(Date.now()-day);
    const [result, blocks, sample] = await Promise.allSettled([
      refreshWarehouseRankings(db, query, today),
      ingestBlocks(db),
      ingestProjectSample(db),
    ]);
    for (const feed of [blocks,sample]) {
      if (feed.status === 'rejected') console.error('Live activity sample failed', feed.reason.message);
    }
    if (result.status === 'rejected') throw result.reason;
    return response.status(200).json(result.value);
  } catch (error) {
    console.error('Activity refresh failed', error.message);
    return response.status(502).json({error:'Activity refresh failed. See function logs.'});
  } finally {
    // Closing this session releases the advisory lock even after an error.
    lock?.release(true);
    await db?.end();
  }
}
