import {transaction} from './store.mjs';
import {warehouseReadMethodologies} from './activity-eligibility.mjs';

export const retentionPolicy={rawExamplesPerContract:20,blockDays:7,rankingDays:365};

// Published summaries contain their own aggregate metrics and transaction links.
// Keep their referenced raw examples as well as each contract's latest sample.
const keepCalls=`WITH recent AS (
  SELECT t.transaction_hash FROM invisible.project_contract c
  CROSS JOIN LATERAL (SELECT transaction_hash FROM invisible.direct_call
    WHERE receiver_id=c.account_id ORDER BY block_time DESC,transaction_hash LIMIT 20) t
), pinned AS (
  SELECT jsonb_array_elements_text(COALESCE(a.item->'evidence','[]'::jsonb)) AS hash
  FROM invisible.ranking_run r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.results->'analysis','[]'::jsonb)) a(item)
  WHERE r.cutoff>=now()-interval '365 days'
  UNION
  SELECT c.item->>'example_transaction'
  FROM invisible.ranking_run r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.results->'analysis','[]'::jsonb)) a(item)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(a.item->'contract_activity','[]'::jsonb)) c(item)
  WHERE r.cutoff>=now()-interval '365 days'
), keep AS (SELECT transaction_hash FROM recent UNION SELECT hash FROM pinned WHERE hash IS NOT NULL)`;

async function safeSnapshot(db) {
  const {rows:[row]}=await db.query(`SELECT cutoff FROM invisible.ranking_run
    WHERE methodology=ANY($1::text[]) AND cutoff>=now()-interval '7 days'
    AND jsonb_array_length(COALESCE(results->'analysis','[]'::jsonb))>0 ORDER BY cutoff DESC LIMIT 1`,[warehouseReadMethodologies]);
  return row;
}

export async function retentionPreview(db) {
  const snapshot=await safeSnapshot(db);
  const {rows:[calls]}=await db.query(keepCalls+` SELECT count(*)::int AS total,
    count(*) FILTER (WHERE keep.transaction_hash IS NULL)::int AS removable
    FROM invisible.direct_call d LEFT JOIN keep ON keep.transaction_hash=d.transaction_hash`);
  return {policy:retentionPolicy,safeToPruneRaw:Boolean(snapshot),snapshotCutoff:snapshot?.cutoff ?? null,...calls};
}

export async function cleanupRetention(db) {
  return transaction(db,async client=>{
    // Never discard imported history if no current published warehouse summary exists.
    const snapshot=await safeSnapshot(client);
    let calls={rowCount:0},coverage={rowCount:0};
    if(snapshot) {
      calls=await client.query(keepCalls+` DELETE FROM invisible.direct_call d
        WHERE NOT EXISTS(SELECT 1 FROM keep WHERE keep.transaction_hash=d.transaction_hash)`);
      // Raw samples cannot substantiate full historical coverage after pruning.
      if(calls.rowCount) coverage=await client.query('DELETE FROM invisible.call_coverage');
    }
    const blocks=await client.query(`DELETE FROM invisible.live_block WHERE block_time<now()-interval '7 days'
      AND hash NOT IN (SELECT hash FROM invisible.live_block ORDER BY height DESC LIMIT 20)`);
    const rankings=await client.query(`DELETE FROM invisible.ranking_run WHERE cutoff<now()-interval '365 days'
      AND cutoff<>(SELECT max(cutoff) FROM invisible.ranking_run)`);
    await client.query('DELETE FROM invisible.wallet_challenge WHERE expires_at<=now()');
    await client.query('DELETE FROM invisible.wallet_session WHERE expires_at<=now()');
    return {status:snapshot ? 'complete':'raw_cleanup_skipped_no_current_summary',policy:retentionPolicy,
      rawCallsDeleted:calls.rowCount,coverageRangesInvalidated:coverage.rowCount,
      blocksDeleted:blocks.rowCount,rankingSnapshotsDeleted:rankings.rowCount};
  });
}
