import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {dateAt} from '../lib/model.mjs';

test('export preserves the last snapshot on coverage failure and writes a complete payload atomically',()=>{
  const temp=mkdtempSync(join(tmpdir(),'invisible-export-'));
  try{
    for(const dir of ['analytics','data','lib','scripts']) cpSync(new URL('../'+dir,import.meta.url),join(temp,dir),{recursive:true});
    const bin=join(temp,'bin');
    mkdirSync(bin);
    writeFileSync(join(bin,'bq'),'#!/bin/sh\ncat >/dev/null\nfor arg in "$@"; do if [ "$arg" = "--dry_run" ]; then exit 0; fi; done\ncat "$FIXTURE"\n',{mode:0o755});
    const fixture=join(temp,'fixture.json');
    const snapshotFile=join(temp,'data/observed.json');
    writeFileSync(snapshotFile,'null\n');
    const end='2026-10-01';
    const daily=Array.from({length:56},(_,i)=>({day:dateAt(end,i-56),accounts:1,tx:1}));
    const catalog=JSON.parse(readFileSync(join(temp,'data/projects.json')));
    const payload={projects:catalog.map(p=>({project:p.id,a7:1,b7:1,a28:1,b28:1,repeat:1,daily,contracts:p.contracts.map(contract=>({contract,tx:28,prevTx:28}))})),network:daily.map(d=>({day:d.day,indexed:1,fees:null}))};
    const write=()=>writeFileSync(fixture,JSON.stringify([{payload:JSON.stringify(payload)}]));
    const run=()=>spawnSync(process.execPath,['scripts/refresh.mjs'],{cwd:temp,encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH,FIXTURE:fixture,BQ_PROJECT:'fixture',SNAPSHOT_END:end,SKIP_GITHUB:'1'}});
    write();
    const result=run();
    assert.equal(result.status,0,result.stderr);
    const raw=readFileSync(snapshotFile,'utf8');
    const snapshot=JSON.parse(raw);
    assert.equal(snapshot.metrics.linear.tx,28);
    assert.equal(snapshot.metrics.linear.attention,null);
    assert.equal(snapshot.network.length,56);
    payload.network[3].indexed=0;
    write();
    const failed=run();
    assert.notEqual(failed.status,0);
    assert.match(failed.stderr,/Missing daily action coverage/);
    assert.equal(readFileSync(snapshotFile,'utf8'),raw);
  }finally{rmSync(temp,{recursive:true,force:true});}
});
