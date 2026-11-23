import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {retentionPreview,cleanupRetention} from '../services/retention.mjs';
import {warehouseActivityMethodology} from '../services/activity-eligibility.mjs';

test('retention preserves ranked summaries, pinned evidence and recent examples without false coverage',
 {skip:!process.env.RETENTION_TEST_DATABASE_URL},async()=>{
  const client=new pg.Client({connectionString:process.env.RETENTION_TEST_DATABASE_URL});
  await client.connect();
  // All mutations stay in session-local temporary tables, never production tables.
  const query=(sql,args)=>client.query(sql.replaceAll('invisible.','pg_temp.'),args);
  const db={query,async connect(){return {query,release(){}}}};
  try {
    await query(`CREATE TEMP TABLE project_contract(account_id text);
      CREATE TEMP TABLE direct_call(transaction_hash text PRIMARY KEY,receiver_id text,block_time timestamptz);
      CREATE TEMP TABLE ranking_run(cutoff timestamptz,methodology text,results jsonb);
      CREATE TEMP TABLE call_coverage(receiver_id text);
      CREATE TEMP TABLE live_block(hash text,height bigint,block_time timestamptz);
      CREATE TEMP TABLE wallet_challenge(expires_at timestamptz);
      CREATE TEMP TABLE wallet_session(expires_at timestamptz);
      INSERT INTO project_contract VALUES ('example.near');
      INSERT INTO direct_call SELECT 'tx-'||i,'example.near',now()-i*interval '1 day' FROM generate_series(1,25) i;
      INSERT INTO call_coverage VALUES ('example.near');
      INSERT INTO live_block SELECT 'b-'||i,i,now()-interval '10 days' FROM generate_series(1,25) i;`);
    const results={analysis:[{evidence:['tx-25'],contract_activity:[{example_transaction:'tx-24'}]}]};
    await query(`INSERT INTO ranking_run VALUES(now()-interval '1 day',$1,$2)`,[warehouseActivityMethodology,results]);
    const before=await retentionPreview(db);
    assert.equal(before.removable,3);assert.equal(before.safeToPruneRaw,true);
    const cleaned=await cleanupRetention(db);
    assert.equal(cleaned.rawCallsDeleted,3);assert.equal(cleaned.coverageRangesInvalidated,1);
    assert.equal(cleaned.blocksDeleted,5);
    const {rows:[after]}=await query(`SELECT (SELECT count(*)::int FROM direct_call) AS calls,
      (SELECT count(*)::int FROM call_coverage) AS coverage,(SELECT results FROM ranking_run LIMIT 1) AS results`);
    assert.equal(after.calls,22);assert.equal(after.coverage,0);assert.deepEqual(after.results,results);
    await query('DELETE FROM ranking_run');
    await query("INSERT INTO direct_call VALUES('extra-old','example.near',now()-interval '100 days')");
    assert.equal((await cleanupRetention(db)).rawCallsDeleted,0,'missing summaries must prevent raw pruning');
  } finally {await client.end()}
});
