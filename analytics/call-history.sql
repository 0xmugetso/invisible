-- One finalized UTC partition per query. @contracts is a JSON array.
SELECT
  transaction_hash,
  receiver_account_id AS receiver_id,
  signer_account_id AS signer_id,
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E3SZ', TIMESTAMP_MICROS(DIV(CAST(block_timestamp AS INT64), 1000)), 'UTC') AS block_time,
  ARRAY_AGG(DISTINCT JSON_VALUE(args, '$.method_name') IGNORE NULLS) AS methods
FROM `bigquery-public-data.crypto_near_mainnet_us.transaction_actions`
WHERE block_date = @day
  AND action_kind = 'FUNCTION_CALL'
  AND receiver_account_id IN UNNEST(JSON_VALUE_ARRAY(@contracts))
  AND signer_account_id IS NOT NULL AND transaction_hash IS NOT NULL
GROUP BY transaction_hash, receiver_id, signer_id, block_time
