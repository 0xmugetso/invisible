import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {dateAt} from '../lib/model.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicRankings = join(root, 'public/rankings');
const files = ['observed.json', 'deployments.json', 'thesis-observed.md'];
const seed = process.argv.includes('--publish-existing');
const watch = process.argv.includes('--watch');
if (seed && watch) throw new Error('Choose either --publish-existing or --watch.');

function publish(stage) {
  const [observed, deployments, report] = files.map(file => readFileSync(join(stage, file)));
  const snapshot = JSON.parse(observed);
  const atlas = JSON.parse(deployments);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot?.end) || snapshot.end !== atlas.end || !report.length) {
    throw new Error('The project and contract exports must cover the same UTC window end.');
  }
  const hash = createHash('sha256').update(observed).update(deployments).update(report).digest('hex').slice(0,12);
  const id = snapshot.end+'-'+hash;
  const targets = [publicRankings];
  if (existsSync(join(root, 'out/index.html'))) targets.push(join(root, 'out/rankings'));
  for (const target of targets) {
    mkdirSync(join(target, id), {recursive:true});
    for (const file of files) {
      const destination = join(target, id, file);
      if (existsSync(destination)) continue;
      const pending = destination+'.'+randomUUID()+'.tmp';
      copyFileSync(join(stage, file), pending);
      renameSync(pending, destination);
    }
    const pending = join(target, 'current.'+randomUUID()+'.tmp');
    writeFileSync(pending, JSON.stringify({id}));
    renameSync(pending, join(target, 'current.json'));
  }
  console.log('Published rankings through '+dateAt(snapshot.end,-1)+' UTC.');
}

function refresh() {
  const end = dateAt(new Date().toISOString().slice(0,10),-1);
  const manifest = join(publicRankings, 'current.json');
  if (!seed && existsSync(manifest) && JSON.parse(readFileSync(manifest,'utf8')).id.slice(0,10) >= end) return;
  const stage = mkdtempSync(join(tmpdir(), 'invisible-rankings-'));
  try {
    if (seed) {
      copyFileSync(join(root, 'data/observed.json'), join(stage, 'observed.json'));
      copyFileSync(join(root, 'public/deployments.json'), join(stage, 'deployments.json'));
    } else {
      const env = {...process.env, SNAPSHOT_END:end, RANKING_STAGE:stage};
      execFileSync(process.execPath, ['scripts/refresh.mjs'], {
        cwd:root, stdio:'inherit', env:{...env,BQ_MAX_BYTES:env.BQ_PROJECT_MAX_BYTES ?? '35000000000'},
      });
      execFileSync(process.execPath, ['scripts/deployments.mjs'], {
        cwd:root, stdio:'inherit', env:{...env,BQ_MAX_BYTES:env.BQ_DEPLOYMENT_MAX_BYTES ?? '130000000000'},
      });
    }
    execFileSync(process.execPath, ['scripts/report.mjs'], {
      cwd:root, stdio:'inherit', env:{...process.env,RANKING_STAGE:stage},
    });
    publish(stage);
  } finally {
    rmSync(stage, {recursive:true, force:true});
  }
}

if (!seed && !process.env.BQ_PROJECT) throw new Error('Set BQ_PROJECT and authenticate the bq CLI before starting the refresh.');
if (!watch) refresh();
else {
  for (;;) {
    try { refresh(); }
    catch (error) { console.error('Ranking refresh failed. Retaining the previous release.', error.message); }
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6);
    const next = now.getTime() < today ? today : today + 86400000;
    console.log('Next ranking refresh check at '+new Date(next).toISOString());
    await setTimeout(next-Date.now());
  }
}
