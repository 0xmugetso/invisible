import {readFile} from 'node:fs/promises';
import {ingestCalls} from './nearblocks.mjs';

export const sixHours = 6*60*60*1000;
export const rankLag = 15*60*1000;
export const rankingCutoff = () => Math.floor((Date.now()-rankLag)/sixHours)*sixHours;

export async function latestBlocks(db) {
  const {rows} = await db.query(`SELECT hash AS block_hash, height::text AS block_height,
    ((extract(epoch FROM block_time)*1000000000)::bigint)::text AS block_timestamp,
    jsonb_build_object('count',transaction_count) AS transactions_agg
    FROM invisible.live_block ORDER BY height DESC LIMIT 20`);
  return {checkedAt:new Date().toISOString(), data:rows};
}

export async function latestProjectActivity(db) {
  const {rows} = await db.query(`SELECT p.id, p.name, call.transaction_hash, call.receiver_id,
    call.block_time, call.methods, call.succeeded
    FROM invisible.project p
    JOIN LATERAL (
      SELECT t.transaction_hash,t.receiver_id,t.block_time,t.methods,t.succeeded
      FROM invisible.project_contract c
      JOIN invisible.direct_call t ON t.receiver_id=c.account_id
      WHERE c.project_id=p.id
      ORDER BY t.block_time DESC,t.transaction_hash LIMIT 1
    ) call ON true
    WHERE NOT p.benchmark AND EXISTS
      (SELECT 1 FROM invisible.project_token token WHERE token.project_id=p.id AND token.active)
    ORDER BY call.block_time DESC,p.id LIMIT 12`);
  return rows;
}

export async function calculateRankings(db, time) {
  const until = new Date(time).toISOString();
  const existing = await db.query('SELECT results FROM invisible.ranking_run WHERE cutoff=$1', [until]);
  if (existing.rowCount) return existing.rows[0].results;
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
  return saved.rows[0].results;
}
