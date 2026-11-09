import {setTimeout as wait} from 'node:timers/promises';
import {storeCalls, trackedContracts} from './store.mjs';

const base = 'https://api.nearblocks.io/v3/';
const gap = 30*60*1000;
const apiKey = process.env.NEARBLOCKS_API_KEY;
const pageCap = Number(process.env.NEARBLOCKS_PAGE_CAP ?? 100);

async function request(path, params) {
  const url = new URL(path, base);
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: apiKey ? {Authorization:'Bearer '+apiKey} : {},
  });
  if (!response.ok) throw new Error('NearBlocks '+path+' returned HTTP '+response.status);
  const payload = await response.json();
  if (!Array.isArray(payload.data)) throw new Error('Invalid NearBlocks data.');
  return payload;
}

function timestamp(value) {
  if (!/^\d{19}$/.test(value ?? '')) throw new Error('Invalid NearBlocks block timestamp.');
  return Number(BigInt(value)/1000000n);
}

export async function ingestBlocks(db) {
  const {data} = await request('blocks', {limit:20});
  if (!data.length) throw new Error('No NearBlocks blocks returned.');
  const blocks = data.map(block => ({
    hash:block.block_hash, height:block.block_height,
    block_time:new Date(timestamp(block.block_timestamp)).toISOString(),
    transaction_count:block.transactions_agg?.count,
  }));
  await db.query(`INSERT INTO invisible.live_block
    SELECT hash,height,block_time,transaction_count FROM jsonb_to_recordset($1::jsonb)
    AS r(hash text,height bigint,block_time timestamptz,transaction_count integer)
    ON CONFLICT (hash) DO UPDATE SET transaction_count=EXCLUDED.transaction_count`, [JSON.stringify(blocks)]);
  return Math.max(...blocks.map(block => Date.parse(block.block_time)));
}

function directCall(tx, contract, time) {
  if (!Array.isArray(tx.actions)) throw new Error('Missing NearBlocks actions for '+contract);
  const calls = tx.actions.filter(action => action.action === 'FUNCTION_CALL');
  if (!calls.length) return null;
  if (!tx.transaction_hash || !tx.signer_account_id) throw new Error('Incomplete NearBlocks transaction.');
  return {
    transaction_hash:tx.transaction_hash, receiver_id:contract, signer_id:tx.signer_account_id,
    block_time:new Date(time).toISOString(), methods:[...new Set(calls.map(call => call.method).filter(Boolean))],
    succeeded:typeof tx.outcomes?.status === 'boolean' ? tx.outcomes.status : null,
  };
}

export async function ingestProjectSample(db) {
  const {rows:contracts} = await db.query(`SELECT c.account_id FROM invisible.project_contract c
    JOIN invisible.project p ON p.id=c.project_id WHERE NOT p.benchmark
    AND EXISTS (SELECT 1 FROM invisible.project_token t WHERE t.project_id=p.id AND t.active)
    ORDER BY c.account_id`);
  const results = new Map();
  for (const {account_id:contract} of contracts) {
    await wait(apiKey ? 750 : 1500);
    const {data} = await request('accounts/'+encodeURIComponent(contract)+'/txns', {limit:20});
    for (const tx of data) {
      if (tx.receiver_account_id !== contract) continue;
      const call = directCall(tx, contract, timestamp(tx.block_timestamp));
      if (call) results.set(call.transaction_hash, call);
    }
  }
  // A sample gives transaction evidence without establishing ranking coverage.
  await storeCalls(db, [...results.values()], [], 'nearblocks');
}

async function fetchCalls(contract, start, end) {
  const rows = new Map();
  const cursors = new Set();
  let cursor;
  let oldest = Infinity;
  for (let page = 0; page < pageCap; page++) {
    await wait(apiKey ? 750 : 1500);
    const {data, meta} = await request('accounts/'+encodeURIComponent(contract)+'/txns',
      {limit:100, ...(cursor ? {next:cursor} : {})});
    for (const tx of data) {
      const time = timestamp(tx.block_timestamp);
      if (time > oldest) throw new Error('NearBlocks pages out of order for '+contract);
      oldest = time;
      if (time < start || time >= end || tx.receiver_account_id !== contract) continue;
      const call = directCall(tx, contract, time);
      if (call) rows.set(call.transaction_hash, call);
    }
    if (!data.length && meta?.next_page) throw new Error('Empty NearBlocks page with a continuation cursor.');
    if (oldest < start || !meta?.next_page) return [...rows.values()];
    cursor = meta.next_page;
    if (cursors.has(cursor)) throw new Error('NearBlocks cursor did not advance.');
    cursors.add(cursor);
  }
  throw new Error('NearBlocks page limit reached before covering '+contract);
}

export async function ingestCalls(db, cutoff) {
  if (!Number.isInteger(pageCap) || pageCap < 1 || pageCap > 500) throw new Error('Use a NearBlocks page cap of 1–500.');
  const indexedTip = await ingestBlocks(db);
  if (indexedTip < cutoff + gap/2) throw new Error('NearBlocks has not indexed far enough past the ranking cutoff.');
  const contracts = await trackedContracts(db);
  const {rows} = await db.query(`SELECT receiver_id, max(through_time) AS watermark
    FROM invisible.call_coverage GROUP BY receiver_id`);
  const watermarks = new Map(rows.map(row => [row.receiver_id, +row.watermark]));
  if (contracts.some(contract => !watermarks.has(contract))) throw new Error('Backfill tracked contracts before advancing live coverage.');
  for (const contract of contracts) {
    const watermark = watermarks.get(contract);
    if (watermark >= cutoff) continue;
    const start = watermark-gap;
    const data = await fetchCalls(contract, start, cutoff);
    await storeCalls(db, data, [{contract, from:new Date(start), through:new Date(cutoff)}], 'nearblocks');
  }
}
