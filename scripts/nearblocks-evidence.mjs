import {writeFile, rename} from 'node:fs/promises';
import projects from '../data/projects.json' with {type:'json'};
import {dateAt} from '../lib/model.mjs';

const today = new Date().toISOString().slice(0, 10);
const end = process.env.SNAPSHOT_END ?? dateAt(today, -1);
if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || dateAt(end, 0) !== end || end >= today) {
  throw new Error('SNAPSHOT_END must be a complete UTC date before today.');
}
const cap = Number(process.env.NEARBLOCKS_PAGE_CAP ?? 8);
if (!Number.isInteger(cap) || cap < 1 || cap > 200) throw new Error('Page cap must be 1–200.');
const cutoff = Date.parse(dateAt(end, -84));
const upper = Date.parse(end);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function collect(contract) {
  const entries = new Map();
  let cursor;
  let oldest = Infinity;
  for (let page = 0; page < cap; page++) {
    const url = new URL(`https://api.nearblocks.io/v3/accounts/${contract}/txns`);
    url.search = new URLSearchParams({limit:'100', ...(cursor ? {next:cursor} : {})}).toString();
    const response = await fetch(url, {signal:AbortSignal.timeout(12000), headers:process.env.NEARBLOCKS_API_KEY ? {Authorization:'Bearer '+process.env.NEARBLOCKS_API_KEY} : {}});
    if (!response.ok) throw new Error('HTTP '+response.status);
    const {data,meta} = await response.json();
    if (!Array.isArray(data) || data.some(tx => !/^\d{19}$/.test(tx.block_timestamp ?? ''))) throw new Error('Unexpected transaction response');
    if (!data.length && (page === 0 || meta?.next_page)) throw new Error('Unexpected empty transaction page');
    let reachedStart = false;
    for (const tx of data) {
      const time = Number(BigInt(tx.block_timestamp) / 1000000n);
      if (time > oldest) throw new Error('Transaction pages are out of order');
      oldest = time;
      if (time < cutoff) { reachedStart = true; continue; }
      if (time >= upper || tx.receiver_account_id !== contract || tx.outcomes?.status !== true ||
          !tx.transaction_hash || !tx.signer_account_id) continue;
      const methods = tx.actions?.filter(action => action.action === 'FUNCTION_CALL' && action.method && !action.method.startsWith('epoch_')).map(action => action.method) ?? [];
      if (methods.length) entries.set(tx.transaction_hash, {time, signer:tx.signer_account_id, methods:[...new Set(methods)], hash:tx.transaction_hash});
    }
    if (reachedStart) return [...entries.values()];
    if (!meta?.next_page) throw new Error('Provider history ended before the window start');
    if (meta.next_page === cursor) throw new Error('Cursor did not advance');
    cursor = meta.next_page;
    await sleep(700);
  }
  throw new Error('Page cap reached before the 84-day window was complete');
}

const result = {source:'NearBlocks v3 account transactions', fetchedAt:new Date().toISOString(), end, projects:{}};
for (const project of projects.filter(p => !p.benchmark)) {
  try {
    const data = [...new Map((await Promise.all(project.contracts.map(collect))).flat().map(tx=>[tx.hash,tx])).values()];
    const windows = [0,1,2].map(i=>data.filter(tx=>Math.floor((tx.time-cutoff)/86400000/28)===i));
    const signers = windows.map(window=>new Set(window.map(tx=>tx.signer)));
    const repeat = [...signers[1]].filter(signer=>signers[0].has(signer));
    const repeatSet = new Set(repeat);
    const methods = new Map();
    for (const tx of windows[1].filter(tx=>repeatSet.has(tx.signer))) {
      for (const method of tx.methods) methods.set(method,(methods.get(method)??0)+1);
    }
    result.projects[project.id] = {signers:signers.map(set=>set.size), transactions:windows.map(window=>window.length),
      repeat:repeat.length, returned:repeat.filter(signer=>signers[2].has(signer)).length,
      methods:[...methods.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6),
      examples:windows[1].filter(tx=>repeatSet.has(tx.signer)).slice(0,3).map(tx=>tx.hash)};
  } catch (error) {
    result.projects[project.id] = {unavailable:error.message};
  }
  console.log(project.name, result.projects[project.id].signers ?? result.projects[project.id].unavailable);
  await sleep(900);
}
const dest = new URL('../data/project-evidence.json',import.meta.url);
const temp = new URL('../data/project-evidence.json.tmp',import.meta.url);
await writeFile(temp, JSON.stringify(result,null,2)+'\n');
await rename(temp,dest);
