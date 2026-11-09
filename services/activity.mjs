import {mkdir, rename, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
import {openDatabase, migrate, seedRegistry} from './store.mjs';
import {backfill} from './historical.mjs';
import {ingestBlocks, ingestProjectSample} from './nearblocks.mjs';
import {calculateRankings, latestBlocks, latestProjectActivity, rankingCutoff as cutoff, rankLag, sixHours} from './rankings.mjs';
const commands = ['setup', 'backfill', 'blocks', 'sample', 'rank', 'watch'];
const [command, start, end] = process.argv.slice(2);
if (!commands.includes(command)) throw new Error('Usage: node services/activity.mjs setup|backfill|blocks|sample|rank|watch');
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
  await publish('blocks.json', await latestBlocks(db));
}

async function refreshRankings(time) {
  const results = await calculateRankings(db, time);
  await publish('rankings.json', results);
  console.log('Published project rankings through', results.cutoff);
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
    case 'sample':
      await ingestProjectSample(db);
      await publish('projects.json', await latestProjectActivity(db));
      break;
    case 'rank': await refreshRankings(cutoff()); break;
    case 'watch': await Promise.all([watchBlocks(),watchRankings()]); break;
  }
} finally {
  await db.end();
}
