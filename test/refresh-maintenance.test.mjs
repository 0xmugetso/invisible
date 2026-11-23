import test from 'node:test';
import assert from 'node:assert/strict';
import {ingestProjectSample} from '../services/nearblocks.mjs';
import {readFile} from 'node:fs/promises';

test('the schedule runs in both UTC half-days without an extra scheduled GitHub trigger',async()=>{
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url)));
  assert.deepEqual(config.crons.map(x=>x.schedule),['0 0 * * *','0 12 * * *']);
  assert.equal(new Set(config.crons.map(x=>x.path)).size,2);
  const workflow=await readFile(new URL('../.github/workflows/refresh.yml',import.meta.url),'utf8');
  assert.ok(!workflow.includes('schedule:'));
});

function sampleDb(count) {
  const saved=[];
  return {saved,async query(sql,args){
    if(sql.includes('SELECT c.account_id')) {
      assert.ok(!sql.includes('LIMIT 12'));
      assert.ok(sql.includes("interval '10 hours'"));
      return {rows:Array.from({length:count},(_,i)=>({account_id:'project'+i+'.near'}))};
    }
    if(sql.includes('INSERT INTO invisible.contract_sample')) saved.push(...args[0]);
    return {rows:[]};
  }};
}

test('one invocation samples every due contract, including beyond the old batch of twelve',async()=>{
  const db=sampleDb(74);let requests=0;
  const result=await ingestProjectSample(db,{requestFeed:async()=>{requests++;return {data:[]}},pause:async()=>{},now:()=>0});
  assert.equal(requests,74);
  assert.equal(db.saved.length,74);
  assert.deepEqual(result,{due:74,sampled:74,failed:0,deferred:0});
});

test('a deadline preserves completed samples and reports deferred work',async()=>{
  const db=sampleDb(4);let time=0;
  const result=await ingestProjectSample(db,{requestFeed:async()=>{time+=100;return {data:[]}},pause:async()=>{},now:()=>time,budgetMs:200,intervalMs:0});
  assert.equal(result.sampled,2);assert.equal(result.deferred,2);assert.equal(db.saved.length,2);
});

test('rate limits delay retries through the shared queue',async()=>{
  const db=sampleDb(2),waits=[];let requests=0;
  const result=await ingestProjectSample(db,{requestFeed:async()=>{
    if(++requests===1){const e=new Error('NearBlocks accounts/example/txns returned HTTP 429');e.retryAfterMs=60000;throw e;}
    return {data:[]};
  },pause:async ms=>{waits.push(ms)},now:()=>0});
  assert.equal(result.sampled,2);assert.equal(result.failed,0);assert.equal(requests,3);
  assert.ok(waits.some(ms=>ms>=60000),'provider cooldown is honored');
});
