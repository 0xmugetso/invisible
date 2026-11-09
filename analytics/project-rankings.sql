WITH bounds AS (
  SELECT $1::timestamptz AS cutoff
), eligible AS (
  SELECT p.*
  FROM invisible.project p
  WHERE NOT p.benchmark
    AND EXISTS (SELECT 1 FROM invisible.project_token t WHERE t.project_id=p.id AND t.active)
    AND EXISTS (SELECT 1 FROM invisible.project_contract c WHERE c.project_id=p.id)
), covered AS (
  SELECT e.*
  FROM eligible e CROSS JOIN bounds b
  WHERE NOT EXISTS (
    SELECT 1 FROM invisible.project_contract c WHERE c.project_id=e.id
    AND NOT COALESCE((
      SELECT range_agg(tstzrange(v.from_time,v.through_time,'[)')) @>
        tstzrange(b.cutoff - interval '1344 hours', b.cutoff,'[)')
      FROM invisible.call_coverage v WHERE v.receiver_id=c.account_id
    ), false)
  )
), calls AS (
  SELECT c.project_id, t.*
  FROM covered p
  JOIN invisible.project_contract c ON c.project_id=p.id
  JOIN invisible.direct_call t ON t.receiver_id=c.account_id
  CROSS JOIN bounds b
  WHERE t.block_time >= b.cutoff - interval '1344 hours' AND t.block_time < b.cutoff
), signers AS (
  SELECT project_id, signer_id,
    bool_or(block_time >= cutoff - interval '672 hours') AS current_month,
    bool_or(block_time < cutoff - interval '672 hours') AS prior_month,
    bool_or(block_time >= cutoff - interval '168 hours') AS current_week,
    bool_or(block_time >= cutoff - interval '336 hours' AND block_time < cutoff - interval '168 hours') AS prior_week
  FROM calls CROSS JOIN bounds GROUP BY project_id, signer_id
), counts AS (
  SELECT project_id,
    count(*) FILTER (WHERE current_month)::int AS current_signers,
    count(*) FILTER (WHERE prior_month)::int AS prior_signers,
    count(*) FILTER (WHERE current_month AND prior_month)::int AS repeat_signers,
    count(*) FILTER (WHERE current_week)::int AS weekly_signers,
    count(*) FILTER (WHERE prior_week)::int AS prior_weekly_signers
  FROM signers GROUP BY project_id
), activity AS (
  SELECT project_id, count(DISTINCT ((block_time AT TIME ZONE 'UTC') - ((cutoff AT TIME ZONE 'UTC')::time - time '00:00'))::date)::int AS active_days,
    (array_agg(transaction_hash ORDER BY block_time DESC, transaction_hash))[1:3] AS evidence
  FROM calls CROSS JOIN bounds WHERE block_time >= cutoff - interval '672 hours'
  GROUP BY project_id
), metrics AS (
  SELECT counts.*, activity.active_days, activity.evidence,
    current_signers::float / prior_signers - 1 AS monthly_growth,
    weekly_signers::float / prior_weekly_signers - 1 AS weekly_growth,
    repeat_signers::float / prior_signers AS returning_share
  FROM counts JOIN activity USING (project_id)
  WHERE current_signers >= 50 AND prior_signers >= 50 AND prior_weekly_signers >= 10
), scored AS (
  SELECT metrics.*,
    round(100 * (0.4*cume_dist() OVER (ORDER BY returning_share) +
      0.4*cume_dist() OVER (ORDER BY monthly_growth) +
      0.2*cume_dist() OVER (ORDER BY active_days)))::int AS score
  FROM metrics
  WHERE (SELECT count(*) FROM covered)=(SELECT count(*) FROM eligible)
    AND (SELECT count(*) FROM metrics)>=3
)
SELECT s.*, p.name,
  (SELECT jsonb_agg(jsonb_build_object('symbol',t.symbol,'account',t.account_id,'evidence',t.evidence_url) ORDER BY t.account_id)
    FROM invisible.project_token t WHERE t.project_id=p.id AND t.active) AS tokens,
  (SELECT jsonb_agg(jsonb_build_object('kind',l.kind,'url',l.url) ORDER BY l.kind,l.url)
    FROM invisible.project_link l WHERE l.project_id=p.id) AS links
FROM scored s JOIN covered p ON p.id=s.project_id
ORDER BY score DESC, repeat_signers DESC, project_id
