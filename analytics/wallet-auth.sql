CREATE TABLE IF NOT EXISTS invisible.wallet_user (
  account_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_signed_in_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invisible.wallet_challenge (
  nonce_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS wallet_challenge_expiry ON invisible.wallet_challenge (expires_at);

CREATE TABLE IF NOT EXISTS invisible.wallet_session (
  token_hash text PRIMARY KEY,
  account_id text NOT NULL REFERENCES invisible.wallet_user(account_id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS wallet_session_expiry ON invisible.wallet_session (expires_at);
