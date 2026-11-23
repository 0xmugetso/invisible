CREATE SCHEMA IF NOT EXISTS invisible;
-- The latest successful evidence and each collection attempt are retained separately.
CREATE TABLE IF NOT EXISTS invisible.social_evidence (
  project_id text PRIMARY KEY,
  observed_at timestamptz NOT NULL,
  evidence jsonb NOT NULL,
  last_attempt_at timestamptz NOT NULL,
  last_attempt jsonb NOT NULL
);
