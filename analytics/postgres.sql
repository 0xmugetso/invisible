CREATE SCHEMA IF NOT EXISTS invisible;

CREATE TABLE IF NOT EXISTS invisible.project (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  benchmark boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS invisible.project_link (
  project_id text NOT NULL REFERENCES invisible.project(id),
  kind text NOT NULL,
  url text NOT NULL CHECK (url LIKE 'https://%'),
  evidence_url text CHECK (evidence_url LIKE 'https://%'),
  PRIMARY KEY (project_id, kind, url)
);

CREATE TABLE IF NOT EXISTS invisible.project_contract (
  account_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES invisible.project(id),
  evidence_url text NOT NULL CHECK (evidence_url LIKE 'https://%')
);

CREATE TABLE IF NOT EXISTS invisible.project_token (
  account_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES invisible.project(id),
  symbol text NOT NULL,
  evidence_url text NOT NULL CHECK (evidence_url LIKE 'https://%'),
  verified_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS invisible.direct_call (
  transaction_hash text PRIMARY KEY,
  receiver_id text NOT NULL REFERENCES invisible.project_contract(account_id),
  signer_id text NOT NULL,
  block_time timestamptz NOT NULL,
  methods text[] NOT NULL,
  succeeded boolean,
  source text NOT NULL CHECK (source IN ('bigquery', 'nearblocks'))
);

CREATE INDEX IF NOT EXISTS direct_call_receiver_time
  ON invisible.direct_call (receiver_id, block_time);

-- A range is committed only alongside its fully fetched transaction rows.
CREATE TABLE IF NOT EXISTS invisible.call_coverage (
  receiver_id text NOT NULL REFERENCES invisible.project_contract(account_id),
  source text NOT NULL CHECK (source IN ('bigquery', 'nearblocks')),
  from_time timestamptz NOT NULL,
  through_time timestamptz NOT NULL CHECK (through_time > from_time),
  PRIMARY KEY (receiver_id, source, from_time, through_time)
);

CREATE TABLE IF NOT EXISTS invisible.live_block (
  hash text PRIMARY KEY,
  height bigint NOT NULL,
  block_time timestamptz NOT NULL,
  transaction_count integer NOT NULL CHECK (transaction_count >= 0)
);

CREATE INDEX IF NOT EXISTS live_block_height ON invisible.live_block (height DESC);

CREATE TABLE IF NOT EXISTS invisible.ranking_run (
  cutoff timestamptz PRIMARY KEY,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  methodology text NOT NULL,
  results jsonb NOT NULL
);
