import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, renameSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {dateAt} from '../lib/model.mjs';

const {BQ_PROJECT, SNAPSHOT_END: end, BQ_MAX_BYTES = '120000000000'} = process.env;
if (!BQ_PROJECT || !end || !/^\d{4}-\d{2}-\d{2}$/.test(end) || dateAt(end,0) !== end || end >= new Date().toISOString().slice(0,10)) {
  throw new Error('Set BQ_PROJECT and a past SNAPSHOT_END (exclusive UTC date).');
}
if (!/^[1-9]\d*$/.test(BQ_MAX_BYTES)) throw new Error('BQ_MAX_BYTES must be a positive integer.');
const sql = readFileSync(new URL('../analytics/deployments.sql',import.meta.url),'utf8');
const args = ['--project_id='+BQ_PROJECT,'--location=us-east1','--format=json','query','--use_legacy_sql=false','--maximum_bytes_billed='+BQ_MAX_BYTES,'--parameter=end:DATE:'+end];
const query = (input, extra=[]) => JSON.parse(execFileSync('bq',[...args,...extra],{input,encoding:'utf8',maxBuffer:80*1024*1024}));
const estimate = query(sql,['--dry_run']).statistics.totalBytesProcessed;
if (BigInt(estimate)>BigInt(BQ_MAX_BYTES)) throw new Error('Estimated scan exceeds BQ_MAX_BYTES.');
console.log('Estimated bytes:',estimate);
if (process.argv.includes('--dry-run')) process.exit(0);

const partitions = query(`SELECT partition_id, SUM(total_rows) AS indexed_rows
FROM \`bigquery-public-data.crypto_near_mainnet_us.INFORMATION_SCHEMA.PARTITIONS\`
WHERE table_name = 'transaction_actions'
  AND partition_id >= FORMAT_DATE('%Y%m%d', DATE_SUB(@end, INTERVAL 84 DAY))
  AND partition_id < FORMAT_DATE('%Y%m%d', @end)
GROUP BY partition_id ORDER BY partition_id`);
if (partitions.length !== 84 || partitions.some((p,i)=>p.partition_id !== dateAt(end,i-84).replaceAll('-','') || Number(p.indexed_rows) <= 0)) {
  throw new Error('Missing daily index partitions. No export written.');
}

const raw = query(sql,['--max_rows=1000000']);
if (!Array.isArray(raw) || !raw.length || raw.length >= 1000000) throw new Error('Invalid or potentially truncated export.');
const fields = ['a','b','c','ab','bc','abc','week','previousWeek','transactions','activeDays'];
const rows = raw.map(row=>{
  const values = fields.map(key=>Number(row[key]??0));
  if (values.some(n=>!Number.isSafeInteger(n)||n<0) || !row.contract) throw new Error('Invalid deployment metrics.');
  const [a,b,c,ab,bc,abc] = values;
  if (ab>Math.min(a,b) || bc>Math.min(b,c) || abc>Math.min(ab,bc)) throw new Error('Invalid cohort overlap.');
  return [row.contract,...values,row.lastActive??null,row.lastDeployment??null,row.examples??[],
    (row.methods??[]).map(m=>[m.method,Number(m.transactions),Number(m.signers),m.example])];
});
if (new Set(rows.map(row=>row[0])).size!==rows.length) throw new Error('Duplicate receiver accounts.');
const output = process.env.RANKING_STAGE ? pathToFileURL(process.env.RANKING_STAGE+'/deployments.json') : new URL('../public/deployments.json',import.meta.url);
const temp = new URL(output.href+'.tmp');
writeFileSync(temp,JSON.stringify({end,exportedAt:new Date().toISOString(),rows}));
renameSync(temp,output);
console.log('Exported',rows.length,'contract accounts through',dateAt(end,-1));
