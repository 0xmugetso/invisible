import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rank,concentration,growth,percentile,dateAt} from '../lib/model.mjs';
import {demo} from '../lib/demo.mjs';
const projects=JSON.parse(readFileSync(new URL('../data/projects.json',import.meta.url)));
test('percentile ties and undefined baselines',()=>{
  assert.equal(growth(5,0),null);
  assert.equal(percentile(10,[5,10,10,20]),50);
  assert.equal(dateAt('2026-11-01',-28),'2026-10-04');
});
test('missing observed snapshot never produces rankings',()=>{
  assert.ok(rank(projects,null).rows.every(r=>r.score===null&&r.signal===null));
});
test('synthetic ranking excludes infrastructure benchmarks and does not infer attention',()=>{
  const {mode,rows}=rank(projects,demo(projects));
  assert.equal(mode,'Adoption Discovery Score');
  assert.ok(rows.some(r=>r.signal==='Adoption signal'));
  assert.ok(rows.every(r=>r.att===null&&r.signal!=='Attention gap'));
  assert.ok(rows.filter(r=>r.benchmark).every(r=>r.score===null));
});
test('complete data enables the full model and missing dimensions rescale for all peers',()=>{
  const s=demo(projects);
  for(const p of projects){s.metrics[p.id].commits=[12,10];s.metrics[p.id].attention=[11,10];}
  const full=rank(projects,s);
  assert.equal(full.mode,'Invisible Score');
  assert.ok(full.rows.some(r=>r.signal==='Attention gap'));
  s.metrics.linear.commits=null;
  const partial=rank(projects,s);
  assert.ok(partial.rows.filter(r=>r.score!==null).every(r=>r.weight===85&&r.components.developer===null));
  assert.equal(partial.rows.find(r=>r.id==='linear').dev,null);
});
test('cohort floor and concentration denominators',()=>{
  const s=demo(projects);
  s.metrics.linear.b28=49;
  assert.equal(rank(projects,s).rows.find(r=>r.id==='linear').score,null);
  assert.equal(concentration([0,0]).hhi,null);
  assert.deepEqual(concentration([50,25,25]),{total:100,top3:1,hhi:.375});
});
