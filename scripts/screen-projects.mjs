import {readFile} from 'node:fs/promises';

const [snapshotPath = 'public/deployments.json'] = process.argv.slice(2);
const {end, rows} = JSON.parse(await readFile(snapshotPath, 'utf8'));
const registry = JSON.parse(await readFile(new URL('../data/activity-registry.json', import.meta.url), 'utf8'));
const contracts = new Map(registry.flatMap(project => Object.keys(project.contracts).map(account => [account, project])));
const tokens = new Map(registry.flatMap(project => project.tokens.map(token => [token.accountId, project])));

const activeContracts = rows.flatMap(([account, , prior, current, , repeat, , , priorWeek]) => {
  if (Math.min(prior, current) < 50 || priorWeek < 10) return [];
  const mapped = contracts.get(account);
  const token = tokens.get(account);
  const status = mapped ? (mapped.benchmark ? 'reference' : 'mapped') : token ? 'token only' : 'needs attribution';
  return [{account, prior, current, repeat, status, project: mapped?.id ?? token?.id ?? null}];
}).sort((a, b) => b.current - a.current || a.account.localeCompare(b.account));

// Contract-level thresholds prioritize review. Smaller contracts can qualify when rolled up as a project.
console.log(JSON.stringify({cutoff:end, scanned:rows.length, activeContracts}, null, 2));
