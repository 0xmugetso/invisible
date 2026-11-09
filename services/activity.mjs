import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
import {openDatabase, migrate, seedRegistry} from './store.mjs';
import {backfill} from './historical.mjs';
import {ingestBlocks, ingestCalls} from './nearblocks.mjs';

const sixHours = 6*60*60*1000;
const rankLag = 15*60*1000;
const cutoff = () => Math.floor((Date.now()-rankLag)/sixHours)*sixHours;
const commands = ['setup', 'backfill', 'blocks', 'rank', 'watch'];
const [command, start, end] = process.argv.slice(2);
if (!commands.includes(command)) throw new Error('Usage: node services/activity.mjs setup|backfill|blocks|rank|watch');
const db = openDatabase();

async function publish(filename, value) {
  const roots = [new URL('../public/activity/', import.meta.url)];
  if (existsSync(new URL('../out/index.html', import.meta.url))) roots.push(new URL('../out/activity/', import.meta.url));
  for (const root of roots) {
    await mkdir(root, {recursive:true});
    const temporary = new URL(filename+'.'+randomUUID()+'.tmp', root);
    await writeFile(temporary, JSON.stringify(value));
    await rename(temporary, new URL(filename, root));
  }
}

async function refreshBlocks() {
  await ingestBlocks(db);
  const {rows} = await db.query(`SELECT hash AS block_hash, height::text AS block_height,
    ((extract(epoch FROM block_time)*1000000000)::bigint)::text AS block_timestamp,
    jsonb_build_object('count',transaction_count) AS transactions_agg
    FROM invisible.live_block ORDER BY height DESC LIMIT 20`);
  await publish('blocks.json', {checkedAt:new Date().toISOString(), data:rows});
}

async function refreshRankings(time) {
  const until = new Date(time).toISOString();
  const existing = await db.query('SELECT results FROM invisible.ranking_run WHERE cutoff=$1', [until]);
  if (existing.rowCount) {
    await publish('rankings.json', existing.rows[0].results);
    return;
  }
  await ingestCalls(db, time);
  const sql = await readFile(new URL('../analytics/project-rankings.sql',import.meta.url), 'utf8');
  const {rows} = await db.query(sql, [until]);
  if (!rows.length) throw new Error('Rankings require complete coverage and at least three verified projects meeting the signer thresholds.');
  const fastestRising = rows.filter(row => row.weekly_growth > 0).sort((a,b) =>
    b.weekly_growth-a.weekly_growth || b.score-a.score || a.project_id.localeCompare(b.project_id)).slice(0,10);
  const methodology = 'activity-v1';
  const results = {cutoff:until, methodology, highestRanked:rows.slice(0,10), fastestRising};
  const saved = await db.query(`INSERT INTO invisible.ranking_run (cutoff,methodology,results) VALUES ($1,$2,$3)
    ON CONFLICT (cutoff) DO UPDATE SET cutoff=EXCLUDED.cutoff RETURNING results`, [until, methodology, results]);
  await publish('rankings.json', saved.rows[0].results);
  console.log('Published project rankings through', until);
}

async function watchBlocks() {
  for (;;) {
    try { await refreshBlocks(); }
    catch (error) { console.error('Block update failed:', error.message); }
    await wait(30000);
  }
}

async function watchRankings() {
  for (;;) {
    const time = cutoff();
    try {
      await refreshRankings(time);
      await wait(Math.max(1000,time+sixHours+rankLag-Date.now()));
    } catch (error) {
      console.error('Ranking update failed:', error.message);
      await wait(15*60*1000);
    }
  }
}

try {
  switch (command) {
    case 'setup': await migrate(db); await seedRegistry(db); break;
    case 'backfill': await backfill(db,start,end); break;
    case 'blocks': await refreshBlocks(); break;
    case 'rank': await refreshRankings(cutoff()); break;
    case 'watch': await Promise.all([watchBlocks(),watchRankings()]); break;
  }
} finally {
  await db.end();
}
