import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {dateAt} from '../lib/model.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const projects=JSON.parse(read('data/projects.json'));
const sql=read('analytics/snapshot.sql');
const hash=s=>createHash('sha256').update(s).digest('hex');
const env=process.env;
const end=env.SNAPSHOT_END;
if(!env.BQ_PROJECT || !end) throw Error('Set BQ_PROJECT and SNAPSHOT_END (exclusive UTC date). See README.');
if(!/^\d{4}-\d\d-\d\d$/.test(end)||dateAt(end,0)!==end||end>dateAt(new Date().toISOString().slice(0,10),-1)) throw Error('Use a valid exclusive end date at least one UTC day old.');
const cap=env.BQ_MAX_BYTES??'200000000000';
if(!/^[1-9]\d*$/.test(cap)) throw Error('BQ_MAX_BYTES must be a positive integer.');
const registry=projects.flatMap(p=>p.contracts.map(contract=>({project:p.id,contract})));
if(new Set(registry.map(r=>r.contract)).size!==registry.length) throw Error('Contract mapped to multiple projects.');
const args=['--project_id='+env.BQ_PROJECT,'--location=us-east1','--format=json','query','--use_legacy_sql=false','--maximum_bytes_billed='+cap,'--parameter=end:DATE:'+end,'--parameter=registry:STRING:'+JSON.stringify(registry)];
const run=extra=>execFileSync('bq',[...args,...extra],{input:sql,encoding:'utf8',maxBuffer:10*1024*1024});
const dryRun = run(['--dry_run']).trim();
if (dryRun) {
  const bytes = JSON.parse(dryRun).statistics?.totalBytesProcessed;
  if (!bytes || BigInt(bytes)>BigInt(cap)) throw Error('Dry run exceeds the byte cap or has no estimate.');
  console.log('BigQuery dry run validated: '+bytes+' bytes estimated.');
}
if(process.argv.includes('--dry-run')) process.exit(0);
const result=JSON.parse(run([]));
const payload=JSON.parse(result[0]?.payload??'null');
if(!payload||payload.network.length!==56||payload.network.some((r,i)=>r.day!==dateAt(end,i-56)||!Number.isSafeInteger(r.indexed)||r.indexed<=0)) throw Error('Missing daily action coverage. No snapshot written.');
if(payload.projects.length!==projects.length||projects.some(p=>!payload.projects.find(x=>x.project===p.id))) throw Error('Unexpected project rows.');
async function commits(repo){
  if(!repo||env.SKIP_GITHUB==='1')return null;
  const url=new URL('https://api.github.com/repos/'+repo+'/commits');
  url.search=new URLSearchParams({since:dateAt(end,-56)+'T00:00:00Z',until:end+'T00:00:00Z',per_page:'100'}).toString();
  try{
    const counts=[0,0],seen=new Set(),boundary=dateAt(end,-28);
    let next=url.href;
    for(let page=0;next&&page<5;page++){
      if(new URL(next).origin!=='https://api.github.com')return null;
      const r=await fetch(next,{headers:{Accept:'application/vnd.github+json',...(env.GITHUB_TOKEN?{Authorization:'Bearer '+env.GITHUB_TOKEN}:{})},signal:AbortSignal.timeout(15000)});
      if(!r.ok)return null;
      for(const c of await r.json()){
        const d=c.commit?.committer?.date?.slice(0,10);
        if(!d||seen.has(c.sha))continue;
        seen.add(c.sha);
        if(d>=dateAt(end,-56)&&d<end) counts[d>=boundary?0:1]++;
      }
      next=r.headers.get('link')?.match(/<([^>]+)>; rel="next"/)?.[1];
    }
    return next?null:counts;
  }catch{return null;}
}
const metrics={};
for(const {project,...row} of payload.projects){
  const p=projects.find(p=>p.id===project);
  const sum=series=>series.reduce((s,d)=>s+d.tx,0);
  if(row.daily.length!==56||row.daily.some((r,i)=>r.day!==dateAt(end,i-56))||row.repeat>Math.min(row.a28,row.b28))throw Error('Invalid cohort or daily data: '+project);
  metrics[project]={...row,tx:sum(row.daily.slice(-28)),prevTx:sum(row.daily.slice(0,28)),commits:await commits(p.repo),attention:null};
}
const snapshot={kind:'observed',end,created:new Date().toISOString(),metrics,network:payload.network,
  provenance:'NEAR Public BigQuery (us-east1) · SQL SHA-256 '+hash(sql).slice(0,16),sqlSha256:hash(sql),registrySha256:hash(JSON.stringify(registry))};
const output = env.RANKING_STAGE ? pathToFileURL(env.RANKING_STAGE+'/observed.json') : new URL('../data/observed.json',import.meta.url);
const tmp = new URL(output.href+'.tmp');
writeFileSync(tmp,JSON.stringify(snapshot,null,2)+'\n');
renameSync(tmp,output);
console.log('Wrote observed snapshot through '+dateAt(end,-1)+'.');
