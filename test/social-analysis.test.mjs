import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSocialSource} from '../services/social-analysis.mjs';

const now='2026-11-23T12:00:00Z';
const source=(count,days=1)=>({status:'collected',posts:Array.from({length:count},(_,i)=>({
  url:'https://x.com/example/status/'+i,publishedAt:new Date(Date.parse(now)-i*days*86400000).toISOString(),
  text:'Project update',
}))});

test('partial samples do not receive a misleading score',()=>{
  assert.equal(analyzeSocialSource(source(7),now).score,null);
  assert.equal(analyzeSocialSource(source(30),now).score,100);
});

test('unavailable, duplicate and future observations cannot inflate a score',()=>{
  const data=source(5);
  data.posts.push(data.posts[0],{url:'https://x.com/example/status/future',publishedAt:'2027-01-01',text:'Future'});
  const result=analyzeSocialSource(data,now);
  assert.equal(result.sampleCount,5);
  assert.equal(result.score,null);
  assert.equal(analyzeSocialSource({...source(30),status:'unavailable'},now).score,null);
});

test('dated sparse timelines can cover the window while missing metrics stay null',()=>{
  const result=analyzeSocialSource(source(6,8),now);
  assert.equal(result.coverage,'covers_30_days');
  assert.equal(result.recentPosts,4);
  assert.equal(result.score,85);
  assert.deepEqual(result.engagement.likes,{median:null,measuredPosts:0});
});

test('engagement reports measured values only and never changes publishing score',()=>{
  const data=source(30);
  data.posts[0].metrics={likes:100};
  data.posts[1].metrics={likes:0};
  const result=analyzeSocialSource(data,now);
  assert.deepEqual(result.engagement.likes,{median:50,measuredPosts:2});
  assert.equal(result.score,100);
});

test('project social reads complete before their database pool closes',async()=>{
  const pg=(await import('pg')).default;
  const {readPublishedResearch}=await import('../services/research-read.mjs');
  const OriginalPool=pg.Pool;
  const previousUrl=process.env.DATABASE_URL;
  let closed=false;
  pg.Pool=class {
    async query(sql) {
      if (sql.includes('ranking_run')) return {rows:[]};
      await new Promise(resolve=>setImmediate(resolve));
      assert.equal(closed,false,'the evidence query must finish before shutdown');
      return {rows:[{evidence:{id:'rhea',sources:[]},observed_at:now,last_attempt_at:now,last_attempt:{status:'partial'}}]};
    }
    async end() { closed=true; }
  };
  process.env.DATABASE_URL='postgresql://unused.invalid/test';
  try {
    const result=await readPublishedResearch('social-project','rhea');
    assert.equal(result.id,'rhea');
    assert.equal(closed,true);
  } finally {
    pg.Pool=OriginalPool;
    if (previousUrl===undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL=previousUrl;
  }
});

test('reposts cannot inflate publishing or authored engagement',()=>{
  const data=source(30);
  data.posts.forEach((post,i)=>{
    post.kind=i<25 ? 'repost' : 'post';
    post.metrics=i<25 ? {likes:99999,replies:99999,reposts:99999,views:1} : {likes:5,replies:2,reposts:3,views:100};
  });
  const result=analyzeSocialSource(data,now);
  assert.equal(result.repostCount,25);
  assert.equal(result.recentAuthoredPosts,5);
  assert.deepEqual(result.engagement.likes,{median:5,measuredPosts:5});
  assert.deepEqual(result.engagementRate,{medianPercent:10,measuredPosts:5});
  assert.ok(result.score<100);
  data.posts[25].kind='repost';
  assert.equal(analyzeSocialSource(data,now).score,null);
});
