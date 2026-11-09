-- BigQuery GoogleSQL. @end is exclusive. @registry is a JSON array of {project,contract}.
WITH registry AS (
  SELECT JSON_VALUE(item,'$.project') project, JSON_VALUE(item,'$.contract') contract
  FROM UNNEST(JSON_QUERY_ARRAY(@registry)) item
), days AS (
  SELECT day FROM UNNEST(GENERATE_DATE_ARRAY(DATE_SUB(@end,INTERVAL 56 DAY),DATE_SUB(@end,INTERVAL 1 DAY))) day
), calls AS (
  SELECT DISTINCT r.project,r.contract,a.block_date day,a.signer_account_id signer,a.transaction_hash tx_id
  FROM `bigquery-public-data.crypto_near_mainnet_us.transaction_actions` a
  JOIN registry r ON r.contract=a.receiver_account_id
  WHERE a.block_date>=DATE_SUB(@end,INTERVAL 56 DAY) AND a.block_date<@end
    AND a.action_kind='FUNCTION_CALL' AND a.signer_account_id IS NOT NULL AND a.transaction_hash IS NOT NULL
), signers AS (
  SELECT project,signer,
    LOGICAL_OR(day>=DATE_SUB(@end,INTERVAL 7 DAY)) a7,
    LOGICAL_OR(day>=DATE_SUB(@end,INTERVAL 14 DAY) AND day<DATE_SUB(@end,INTERVAL 7 DAY)) b7,
    LOGICAL_OR(day>=DATE_SUB(@end,INTERVAL 28 DAY)) a28,
    LOGICAL_OR(day<DATE_SUB(@end,INTERVAL 28 DAY)) b28
  FROM calls GROUP BY 1,2
), cohorts AS (
  SELECT project,COUNTIF(a7) a7,COUNTIF(b7) b7,COUNTIF(a28) a28,COUNTIF(b28) b28,COUNTIF(a28 AND b28) repeat
  FROM signers GROUP BY 1
), daily AS (
  SELECT project,day,COUNT(DISTINCT signer) accounts,COUNT(DISTINCT tx_id) tx
  FROM calls GROUP BY 1,2
), contracts AS (
  SELECT project,contract,
    COUNT(DISTINCT IF(day>=DATE_SUB(@end,INTERVAL 28 DAY),tx_id,NULL)) tx,
    COUNT(DISTINCT IF(day<DATE_SUB(@end,INTERVAL 28 DAY),tx_id,NULL)) prevTx
  FROM calls GROUP BY 1,2
), project_days AS (
  SELECT p.project, ARRAY_AGG(STRUCT(days.day AS day,COALESCE(d.accounts,0) AS accounts,COALESCE(d.tx,0) AS tx) ORDER BY days.day) AS daily
  FROM (SELECT DISTINCT project FROM registry) p CROSS JOIN days
  LEFT JOIN daily d ON d.day=days.day AND d.project=p.project
  GROUP BY p.project
), project_contracts AS (
  SELECT r.project,ARRAY_AGG(STRUCT(r.contract AS contract,COALESCE(k.tx,0) AS tx,COALESCE(k.prevTx,0) AS prevTx) ORDER BY r.contract) AS contracts
  FROM registry r LEFT JOIN contracts k ON k.project=r.project AND k.contract=r.contract
  GROUP BY r.project
), conversion AS (
  SELECT block_date day, transaction_hash id, MAX(SAFE_CAST(receipt_conversion_tokens_burnt AS BIGNUMERIC)) yocto
  FROM `bigquery-public-data.crypto_near_mainnet_us.transactions`
  WHERE block_date>=DATE_SUB(@end,INTERVAL 56 DAY) AND block_date<@end GROUP BY 1,2
), execution AS (
  SELECT block_date day, receipt_id id, MAX(SAFE_CAST(tokens_burnt AS BIGNUMERIC)) yocto
  FROM `bigquery-public-data.crypto_near_mainnet_us.execution_outcomes`
  WHERE block_date>=DATE_SUB(@end,INTERVAL 56 DAY) AND block_date<@end GROUP BY 1,2
), fee_totals AS (
  SELECT day, IF(COUNTIF(yocto IS NULL)>0 OR COUNT(DISTINCT stage)<2,NULL,
    CAST(SUM(yocto)/BIGNUMERIC '1000000000000000000000000' AS FLOAT64)) fees
  FROM (SELECT day,yocto,'tx' stage FROM conversion UNION ALL SELECT day,yocto,'receipt' stage FROM execution)
  GROUP BY day
), coverage AS (
  SELECT block_date day, COUNT(DISTINCT transaction_hash) indexed
  FROM `bigquery-public-data.crypto_near_mainnet_us.transaction_actions`
  WHERE block_date>=DATE_SUB(@end,INTERVAL 56 DAY) AND block_date<@end GROUP BY 1
)
SELECT TO_JSON_STRING(STRUCT(
  ARRAY(SELECT AS STRUCT p.project,COALESCE(c.a7,0) a7,COALESCE(c.b7,0) b7,COALESCE(c.a28,0) a28,COALESCE(c.b28,0) b28,COALESCE(c.repeat,0) repeat,p.daily,k.contracts
    FROM project_days p JOIN project_contracts k USING(project) LEFT JOIN cohorts c USING(project) ORDER BY p.project) AS projects,
  ARRAY(SELECT AS STRUCT days.day,f.fees,COALESCE(a.indexed,0) indexed FROM days LEFT JOIN fee_totals f USING(day) LEFT JOIN coverage a USING(day) ORDER BY days.day) AS network
)) AS payload
