import pg from 'pg';
import {readFile} from 'node:fs/promises';

export function openDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to a PostgreSQL database.');
  return new pg.Pool({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000});
}

export async function transaction(db, write) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await write(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function migrate(db) {
  await db.query(await readFile(new URL('../analytics/postgres.sql', import.meta.url), 'utf8'));
}

export async function seedRegistry(db) {
  const registry = JSON.parse(await readFile(process.env.ACTIVITY_REGISTRY ??
    new URL('../data/activity-registry.json', import.meta.url), 'utf8'));
  await transaction(db, async client => {
    for (const {id, name, category, description, contracts, tokens, links, benchmark} of registry) {
      await client.query(`INSERT INTO invisible.project VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO UPDATE SET name=$2, category=$3, description=$4, benchmark=$5`,
      [id, name, category, description, benchmark ?? false]);
      for (const [account, evidence] of Object.entries(contracts)) {
        await client.query(`INSERT INTO invisible.project_contract VALUES ($1,$2,$3)
          ON CONFLICT (account_id) DO UPDATE SET evidence_url=$3
          WHERE invisible.project_contract.project_id=$2`, [account, id, evidence]).then(result => {
          if (!result.rowCount) throw new Error('Contract already attributed to another project: '+account);
        });
      }
      for (const {accountId, symbol, evidence} of tokens) {
        await client.query(`INSERT INTO invisible.project_token VALUES ($1,$2,$3,$4,now())
          ON CONFLICT (account_id) DO UPDATE SET symbol=$3, evidence_url=$4
          WHERE invisible.project_token.project_id=$2`, [accountId, id, symbol, evidence]).then(result => {
          if (!result.rowCount) throw new Error('Token already attributed to another project: '+accountId);
        });
      }
      for (const [kind, link] of Object.entries(links)) {
        const {url, evidence} = typeof link === 'string' ? {url:link, evidence:link} : link;
        await client.query(`INSERT INTO invisible.project_link VALUES ($1,$2,$3,$4)
          ON CONFLICT (project_id,kind,url) DO UPDATE SET evidence_url=$4`, [id, kind, url, evidence]);
      }
    }
  });
}

export async function trackedContracts(db) {
  const {rows} = await db.query('SELECT account_id FROM invisible.project_contract ORDER BY account_id');
  if (!rows.length) throw new Error('Seed the verified project registry first.');
  return rows.map(row => row.account_id);
}

export async function storeCalls(db, rows, ranges, source) {
  await transaction(db, async client => {
    for (let offset = 0; offset < rows.length; offset += 2000) {
      await client.query(`INSERT INTO invisible.direct_call
        SELECT transaction_hash, receiver_id, signer_id, block_time, methods, succeeded, $2
        FROM jsonb_to_recordset($1::jsonb) AS r(transaction_hash text, receiver_id text,
          signer_id text, block_time timestamptz, methods text[], succeeded boolean)
        ON CONFLICT (transaction_hash) DO UPDATE
        SET methods=CASE WHEN cardinality(EXCLUDED.methods)>0 THEN EXCLUDED.methods ELSE direct_call.methods END,
          succeeded=COALESCE(EXCLUDED.succeeded,direct_call.succeeded)`,
      [JSON.stringify(rows.slice(offset, offset+2000)), source]);
    }
    for (const {contract, from, through} of ranges) {
      await client.query('INSERT INTO invisible.call_coverage VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [contract, source, from, through]);
    }
  });
}
