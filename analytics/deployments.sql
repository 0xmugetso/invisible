-- Observed direct calls and deployment actions in three complete 28-day UTC windows.
WITH source AS (
  SELECT block_date AS day, receiver_account_id AS contract, signer_account_id AS signer,
    transaction_hash AS tx, action_kind, JSON_VALUE(args, '$.method_name') AS method
  FROM `bigquery-public-data.crypto_near_mainnet_us.transaction_actions`
  WHERE block_date >= DATE_SUB(@end, INTERVAL 84 DAY) AND block_date < @end
    AND action_kind IN ('FUNCTION_CALL','DEPLOY_CONTRACT','DEPLOY_GLOBAL_CONTRACT','USE_GLOBAL_CONTRACT')
    AND receiver_account_id IS NOT NULL AND transaction_hash IS NOT NULL
), calls AS (
  SELECT DISTINCT contract, signer, day, tx, method,
    DIV(DATE_DIFF(day, DATE_SUB(@end, INTERVAL 84 DAY), DAY), 28) AS period
  FROM source WHERE action_kind = 'FUNCTION_CALL' AND signer IS NOT NULL
), signer_windows AS (
  SELECT contract, signer,
    LOGICAL_OR(period=0) AS first, LOGICAL_OR(period=1) AS middle, LOGICAL_OR(period=2) AS latest,
    LOGICAL_OR(day >= DATE_SUB(@end, INTERVAL 7 DAY)) AS week,
    LOGICAL_OR(day >= DATE_SUB(@end, INTERVAL 14 DAY) AND day < DATE_SUB(@end, INTERVAL 7 DAY)) AS previous_week
  FROM calls GROUP BY contract, signer
), cohorts AS (
  SELECT contract, COUNTIF(first) AS a, COUNTIF(middle) AS b, COUNTIF(latest) AS c,
    COUNTIF(first AND middle) AS ab, COUNTIF(middle AND latest) AS bc,
    COUNTIF(first AND middle AND latest) AS abc, COUNTIF(week) AS week, COUNTIF(previous_week) AS previousWeek
  FROM signer_windows GROUP BY contract
), recent AS (
  SELECT contract, COUNT(DISTINCT tx) AS transactions,
    COUNT(DISTINCT day) AS activeDays, MAX(day) AS lastActive,
    ARRAY_AGG(DISTINCT tx ORDER BY tx LIMIT 2) AS examples
  FROM calls WHERE period=2 GROUP BY contract
), repeat_method_counts AS (
  SELECT c.contract,c.method,COUNT(DISTINCT c.tx) AS transactions,
    COUNT(DISTINCT c.signer) AS signers, MIN(c.tx) AS example
  FROM calls c JOIN signer_windows s USING(contract, signer)
  WHERE c.period=1 AND s.first AND s.middle AND c.method IS NOT NULL
  GROUP BY c.contract,c.method
), methods AS (
  SELECT contract, ARRAY_AGG(STRUCT(method,transactions,signers,example)
    ORDER BY signers DESC, transactions DESC, method LIMIT 4) AS methods
  FROM repeat_method_counts GROUP BY contract
), deployments AS (
  SELECT contract, MAX(day) AS lastDeployment
  FROM source WHERE action_kind != 'FUNCTION_CALL' GROUP BY contract
), universe AS (
  SELECT contract FROM cohorts UNION DISTINCT SELECT contract FROM deployments
)
SELECT u.contract, c.a, c.b, c.c, c.ab, c.bc, c.abc, c.week, c.previousWeek,
  r.transactions, r.activeDays, r.lastActive, r.examples, m.methods, d.lastDeployment
FROM universe u LEFT JOIN cohorts c USING(contract) LEFT JOIN recent r USING(contract)
LEFT JOIN methods m USING(contract) LEFT JOIN deployments d USING(contract)
ORDER BY u.contract
