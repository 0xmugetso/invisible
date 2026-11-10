import {readFile} from 'node:fs/promises';

const coverageQuery = `WITH partitions AS (
  SELECT DISTINCT partition_id
  FROM \`bigquery-public-data.crypto_near_mainnet_us.INFORMATION_SCHEMA.PARTITIONS\`
  WHERE table_name='transaction_actions' AND total_rows>0
), candidates AS (
  SELECT cutoff FROM UNNEST(GENERATE_DATE_ARRAY(DATE_SUB(@day, INTERVAL 14 DAY), @day)) AS cutoff
), coverage AS (
  SELECT cutoff, COUNT(p.partition_id) AS covered_days
  FROM candidates CROSS JOIN UNNEST(GENERATE_DATE_ARRAY(DATE_SUB(cutoff, INTERVAL 56 DAY), cutoff)) AS day
  LEFT JOIN partitions p ON p.partition_id=FORMAT_DATE('%Y%m%d',day)
  GROUP BY cutoff
)
SELECT FORMAT_DATE('%Y-%m-%d',cutoff) AS cutoff
FROM coverage WHERE covered_days=57 ORDER BY cutoff DESC LIMIT 1`;

export async function refreshWarehouseRankings(db, query, today) {
  const project = process.env.BQ_PROJECT;
  const byteCap = process.env.BQ_PROJECT_MAX_BYTES ?? '35000000000';
  if (!project || !/^[1-9]\d*$/.test(byteCap)) throw new Error('Set BQ_PROJECT and a positive ranking query cap.');
  const options = {project, byteCap, maxRows:100000};
  const [{cutoff:day} = {}] = await query(coverageQuery, {day:today}, options);
  if (!day) return {status:'waiting_for_warehouse'};
  const cutoff = day+'T00:00:00.000Z';
  const methodology = 'activity-warehouse-v1';
  const existing = await db.query('SELECT 1 FROM invisible.ranking_run WHERE cutoff=$1 AND methodology=$2', [cutoff, methodology]);
  if (existing.rowCount) return {status:'already_current', cutoff};

  const {rows:projects} = await db.query(`SELECT p.id,p.name,
    ARRAY(SELECT c.account_id FROM invisible.project_contract c WHERE c.project_id=p.id ORDER BY c.account_id) AS contracts,
    (SELECT jsonb_agg(jsonb_build_object('symbol',t.symbol,'account',t.account_id,'evidence',t.evidence_url) ORDER BY t.account_id)
      FROM invisible.project_token t WHERE t.project_id=p.id AND t.active) AS tokens,
    (SELECT jsonb_agg(jsonb_build_object('kind',l.kind,'url',l.url) ORDER BY l.kind,l.url)
      FROM invisible.project_link l WHERE l.project_id=p.id) AS links
    FROM invisible.project p WHERE NOT p.benchmark
    AND EXISTS (SELECT 1 FROM invisible.project_contract c WHERE c.project_id=p.id)
    AND EXISTS (SELECT 1 FROM invisible.project_token t WHERE t.project_id=p.id AND t.active)
    ORDER BY p.id`);
  if (!projects.length) throw new Error('Seed the verified project registry first.');
  const registry = projects.flatMap(p => p.contracts.map(contract => ({project:p.id, contract})));
  const sql = await readFile(new URL('../analytics/warehouse-rankings.sql',import.meta.url), 'utf8');
  const rows = await query(sql, {day,registry:JSON.stringify(registry)}, options);
  const byProject = new Map(rows.map(row => [row.project_id,row]));
  if (rows.length !== projects.length || projects.some(p => !byProject.has(p.id))) throw new Error('Incomplete warehouse ranking result.');
  const analysis = projects.map(({id,name,tokens,links}) => ({...byProject.get(id),name,tokens,links}));
  const eligible = analysis.filter(row => row.current_signers >= 50 && row.prior_signers >= 50 && row.prior_weekly_signers >= 10);
  const percentile = (key, value) => eligible.filter(row => row[key] <= value).length / eligible.length;
  const ranked = eligible.length < 3 ? [] : eligible.map(row => ({...row, score:Math.round(100*(
    .4*percentile('returning_share',row.returning_share) +
    .4*percentile('monthly_growth',row.monthly_growth) +
    .2*percentile('active_days',row.active_days)
  ))})).sort((a,b) => b.score-a.score || b.repeat_signers-a.repeat_signers || a.project_id.localeCompare(b.project_id));
  const results = {cutoff,methodology,analysis,highestRanked:ranked.slice(0,10),
    fastestRising:ranked.filter(row => row.weekly_growth > 0).sort((a,b) =>
      b.weekly_growth-a.weekly_growth || b.score-a.score || a.project_id.localeCompare(b.project_id)).slice(0,10)};
  await db.query(`INSERT INTO invisible.ranking_run (cutoff,methodology,results) VALUES ($1,$2,$3)
    ON CONFLICT (cutoff) DO UPDATE SET methodology=EXCLUDED.methodology, results=EXCLUDED.results,
      calculated_at=now()`, [cutoff,methodology,results]);
  return {status:'complete', cutoff, projects:analysis.length, ranked:ranked.length};
}
