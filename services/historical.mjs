import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {storeCalls, trackedContracts} from './store.mjs';

const dayMs = 86400000;

export async function backfill(db, start, end) {
  const project = process.env.BQ_PROJECT;
  const byteCap = process.env.BQ_HISTORY_MAX_BYTES ?? '10000000000';
  if (!project || !/^[1-9]\d*$/.test(byteCap)) throw new Error('Set BQ_PROJECT and a positive history query cap.');
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  const today = new Date().toISOString().slice(0,10);
  if (!valid(start) || !valid(end) || start >= end || end >= today) {
    throw new Error('Pass valid UTC dates: backfill YYYY-MM-DD YYYY-MM-DD (exclusive end before today).');
  }
  const contracts = await trackedContracts(db);
  const sql = await readFile(new URL('../analytics/call-history.sql', import.meta.url), 'utf8');
  const maxRows = 1000000;
  for (let time = Date.parse(start); time < Date.parse(end); time += dayMs) {
    const from = new Date(time).toISOString();
    const through = new Date(time+dayMs).toISOString();
    const day = from.slice(0,10);
    const {rows: [coverage]} = await db.query(`SELECT count(DISTINCT receiver_id)::int AS count
      FROM invisible.call_coverage WHERE from_time <= $1 AND through_time >= $2
      AND receiver_id = ANY($3::text[])`, [from, through, contracts]);
    if (coverage.count === contracts.length) continue;
    const args = ['--project_id='+project, '--location=us-east1', '--format=json', 'query',
      '--use_legacy_sql=false', '--maximum_bytes_billed='+byteCap, '--max_rows='+maxRows,
      '--parameter=day:DATE:'+day];
    const run = (input, extra=[]) => JSON.parse(execFileSync('bq', [...args,...extra], {
      input, encoding:'utf8', maxBuffer:512*1024*1024, timeout:600000,
    }));
    const partitions = run(`SELECT COUNT(DISTINCT partition_id) AS covered
      FROM \`bigquery-public-data.crypto_near_mainnet_us.INFORMATION_SCHEMA.PARTITIONS\`
      WHERE table_name='transaction_actions' AND total_rows>0 AND partition_id IN
        (FORMAT_DATE('%Y%m%d', @day), FORMAT_DATE('%Y%m%d', DATE_ADD(@day, INTERVAL 1 DAY)))`);
    if (Number(partitions[0]?.covered) !== 2) throw new Error('Warehouse coverage is missing for '+day+' or the following day.');
    const rows = run(sql, ['--parameter=contracts:STRING:'+JSON.stringify(contracts)]);
    if (!Array.isArray(rows) || rows.length >= maxRows || rows.some(row =>
      !contracts.includes(row.receiver_id) || !row.transaction_hash || !row.signer_id ||
      !Array.isArray(row.methods) || !(Date.parse(row.block_time) >= time && Date.parse(row.block_time) < time+dayMs))) {
      throw new Error('Invalid or potentially truncated BigQuery result for '+day);
    }
    await storeCalls(db, rows, contracts.map(contract => ({contract, from, through})), 'bigquery');
    console.log(day, rows.length, 'transactions stored');
  }
}
