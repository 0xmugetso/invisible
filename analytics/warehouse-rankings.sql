-- Two ranking windows, plus an earlier 28-day window when warehouse coverage permits.
WITH registry AS (
  SELECT JSON_VALUE(item,'$.project') AS project_id, JSON_VALUE(item,'$.contract') AS contract
  FROM UNNEST(JSON_QUERY_ARRAY(@registry)) AS item
), calls AS (
  SELECT DISTINCT r.project_id, r.contract, a.block_date AS day, a.signer_account_id AS signer,
    a.transaction_hash AS tx_hash, a.block_timestamp AS block_time
  FROM `bigquery-public-data.crypto_near_mainnet_us.transaction_actions` a
  JOIN registry r ON r.contract=a.receiver_account_id
  WHERE a.block_date >= @history_start AND a.block_date < @day
    AND a.action_kind='FUNCTION_CALL'
    AND a.signer_account_id IS NOT NULL AND a.transaction_hash IS NOT NULL
), signers AS (
  SELECT project_id, signer,
    LOGICAL_OR(day >= DATE_SUB(@day, INTERVAL 28 DAY)) AS current_month,
    LOGICAL_OR(day >= DATE_SUB(@day, INTERVAL 56 DAY) AND day < DATE_SUB(@day, INTERVAL 28 DAY)) AS prior_month,
    LOGICAL_OR(day < DATE_SUB(@day, INTERVAL 56 DAY)) AS early_month,
    LOGICAL_OR(day >= DATE_SUB(@day, INTERVAL 7 DAY)) AS current_week,
    LOGICAL_OR(day >= DATE_SUB(@day, INTERVAL 14 DAY) AND day < DATE_SUB(@day, INTERVAL 7 DAY)) AS prior_week
  FROM calls GROUP BY project_id, signer
), counts AS (
  SELECT project_id, COUNTIF(current_month) AS current_signers, COUNTIF(prior_month) AS prior_signers,
    COUNTIF(current_month AND prior_month) AS repeat_signers,
    COUNTIF(early_month) AS early_signers, COUNTIF(early_month AND prior_month) AS early_repeat_signers,
    COUNTIF(current_week) AS weekly_signers, COUNTIF(prior_week) AS prior_weekly_signers
  FROM signers GROUP BY project_id
), daily AS (
  SELECT project_id, day, COUNT(DISTINCT signer) AS signers
  FROM calls WHERE day >= DATE_SUB(@day, INTERVAL 28 DAY)
  GROUP BY project_id, day
), consistency AS (
  SELECT project_id, COUNT(*) AS active_days,
    1 - SAFE_DIVIDE(MAX(signers), SUM(signers)) AS spread
  FROM daily GROUP BY project_id
), activity AS (
  SELECT project_id,
    ARRAY_AGG(tx_hash ORDER BY block_time DESC, tx_hash LIMIT 3) AS evidence
  FROM (SELECT DISTINCT project_id, tx_hash, block_time FROM calls WHERE day >= DATE_SUB(@day, INTERVAL 28 DAY))
  GROUP BY project_id
), contract_signers AS (
  SELECT project_id, contract, signer,
    LOGICAL_OR(day >= DATE_SUB(@day, INTERVAL 28 DAY)) AS current_month,
    LOGICAL_OR(day < DATE_SUB(@day, INTERVAL 28 DAY)) AS prior_month,
    MAX(IF(day >= DATE_SUB(@day, INTERVAL 28 DAY),block_time,NULL)) AS last_call,
    MAX_BY(tx_hash,IF(day >= DATE_SUB(@day, INTERVAL 28 DAY),block_time,NULL)) AS sample_tx
  FROM calls WHERE day >= DATE_SUB(@day, INTERVAL 56 DAY) GROUP BY project_id, contract, signer
), contract_counts AS (
  SELECT project_id, contract, COUNTIF(current_month) AS current_signers,
    COUNTIF(prior_month) AS prior_signers, COUNTIF(current_month AND prior_month) AS repeat_signers,
    MAX_BY(sample_tx,last_call) AS example_transaction
  FROM contract_signers GROUP BY project_id, contract
), contract_activity AS (
  SELECT r.project_id, ARRAY_AGG(STRUCT(r.contract AS account,
    COALESCE(c.current_signers,0) AS current_signers, COALESCE(c.prior_signers,0) AS prior_signers,
    COALESCE(c.repeat_signers,0) AS repeat_signers, c.example_transaction) ORDER BY r.contract) AS contract_activity
  FROM registry r LEFT JOIN contract_counts c USING (project_id,contract) GROUP BY r.project_id
)
SELECT p.project_id, COALESCE(c.current_signers,0) AS current_signers,
  COALESCE(c.prior_signers,0) AS prior_signers, COALESCE(c.repeat_signers,0) AS repeat_signers,
  COALESCE(c.early_signers,0) AS early_signers, COALESCE(c.early_repeat_signers,0) AS early_repeat_signers,
  COALESCE(c.weekly_signers,0) AS weekly_signers, COALESCE(c.prior_weekly_signers,0) AS prior_weekly_signers,
  COALESCE(d.active_days,0) AS active_days, COALESCE(d.spread,0) AS spread,
  IFNULL(a.evidence,[]) AS evidence, b.contract_activity,
  SAFE_DIVIDE(c.current_signers,c.prior_signers)-1 AS monthly_growth,
  SAFE_DIVIDE(c.weekly_signers,c.prior_weekly_signers)-1 AS weekly_growth,
  SAFE_DIVIDE(c.repeat_signers,c.prior_signers) AS returning_share
FROM (SELECT DISTINCT project_id FROM registry) p
LEFT JOIN counts c USING (project_id)
LEFT JOIN activity a USING (project_id)
JOIN contract_activity b USING (project_id)
LEFT JOIN consistency d USING (project_id)
