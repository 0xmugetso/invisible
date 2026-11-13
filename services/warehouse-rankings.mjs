import {rankActivity, warehouseActivityMethodology} from './activity-eligibility.mjs';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const coverageQuery = `WITH partitions AS (
  SELECT DISTINCT partition_id
  FROM \`bigquery-public-data.crypto_near_mainnet_us.INFORMATION_SCHEMA.PARTITIONS\`
  WHERE table_name='transaction_actions' AND total_rows>0
), candidates AS (
  SELECT cutoff FROM UNNEST(GENERATE_DATE_ARRAY(DATE_SUB(@day, INTERVAL 14 DAY), @day)) AS cutoff
), coverage AS (
  SELECT cutoff, COUNTIF(day >= DATE_SUB(cutoff, INTERVAL 56 DAY) AND p.partition_id IS NOT NULL) AS covered_days,
    COUNT(p.partition_id) AS forecast_days
  FROM candidates CROSS JOIN UNNEST(GENERATE_DATE_ARRAY(DATE_SUB(cutoff, INTERVAL 84 DAY), cutoff)) AS day
  LEFT JOIN partitions p ON p.partition_id=FORMAT_DATE('%Y%m%d',day)
  GROUP BY cutoff
)
SELECT FORMAT_DATE('%Y-%m-%d',cutoff) AS cutoff,
  FORMAT_DATE('%Y-%m-%d',DATE_SUB(cutoff, INTERVAL IF(forecast_days=85,84,56) DAY)) AS history_start,
  forecast_days=85 AS forecast_ready
FROM coverage WHERE covered_days=57 ORDER BY cutoff DESC LIMIT 1`;

export async function refreshWarehouseRankings(db, query, today) {
  const project = process.env.BQ_PROJECT;
  const byteCap = process.env.BQ_PROJECT_MAX_BYTES ?? '35000000000';
  if (!project || !/^[1-9]\d*$/.test(byteCap)) throw new Error('Set BQ_PROJECT and a positive ranking query cap.');
  const options = {project, byteCap, maxRows:100000};
  const [{cutoff:day, history_start:historyStart, forecast_ready:forecastReady} = {}] = await query(coverageQuery, {day:today}, options);
  if (!day) return {status:'waiting_for_warehouse'};
  const cutoff = day+'T00:00:00.000Z';
  const methodology = warehouseActivityMethodology;
  const {rows:projects} = await db.query(`SELECT p.id,p.name,
    ARRAY(SELECT c.account_id FROM invisible.project_contract c WHERE c.project_id=p.id ORDER BY c.account_id) AS contracts,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('symbol',t.symbol,'account',t.account_id,'evidence',t.evidence_url) ORDER BY t.account_id)
      FROM invisible.project_token t WHERE t.project_id=p.id AND t.active),'[]'::jsonb) AS tokens,
    (SELECT jsonb_agg(jsonb_build_object('kind',l.kind,'url',l.url) ORDER BY l.kind,l.url)
      FROM invisible.project_link l WHERE l.project_id=p.id) AS links
    FROM invisible.project p WHERE NOT p.benchmark
    AND EXISTS (SELECT 1 FROM invisible.project_contract c WHERE c.project_id=p.id)
    ORDER BY p.id`);
  if (!projects.length) throw new Error('Seed verified product contracts first.');
  const registry = projects.flatMap(p => p.contracts.map(contract => ({project:p.id, contract})));
  const registryVersion = createHash('sha256').update(JSON.stringify({projects,forecastReady})).digest('hex');
  const existing = await db.query(
    "SELECT 1 FROM invisible.ranking_run WHERE cutoff=$1 AND methodology=$2 AND results->>'registryVersion'=$3",
    [cutoff, methodology, registryVersion]);
  if (existing.rowCount) return {status:'already_current', cutoff};

  const sql = await readFile(new URL('../analytics/warehouse-rankings.sql',import.meta.url), 'utf8');
  const rows = await query(sql, {day,history_start:historyStart,registry:JSON.stringify(registry)}, options);
  const byProject = new Map(rows.map(row => [row.project_id,row]));
  if (rows.length !== projects.length || projects.some(p => !byProject.has(p.id))) throw new Error('Incomplete warehouse ranking result.');
  const analysis = projects.map(({id,name,contracts,tokens,links}) => ({...byProject.get(id),name,contracts,tokens,links}));
  const {weights,ranked} = rankActivity(analysis);
  const results = {cutoff,methodology,registryVersion,forecastReady,analysis,weights,rankedCount:ranked.length,highestRanked:ranked,
    fastestRising:ranked.filter(row => row.adjusted_weekly_growth > 0).sort((a,b) =>
      b.adjusted_weekly_growth-a.adjusted_weekly_growth || b.score-a.score || a.project_id.localeCompare(b.project_id))};
  await db.query(`INSERT INTO invisible.ranking_run (cutoff,methodology,results) VALUES ($1,$2,$3)
    ON CONFLICT (cutoff) DO UPDATE SET methodology=EXCLUDED.methodology, results=EXCLUDED.results,
      calculated_at=now()`, [cutoff,methodology,results]);
  return {status:'complete', cutoff, projects:analysis.length, ranked:ranked.length};
}
