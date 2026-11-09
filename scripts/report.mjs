import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {rank,concentration,pct,change,dateAt,VERSION} from '../lib/model.mjs';
import {demo} from '../lib/demo.mjs';
const file=p=>new URL('../'+p,import.meta.url);
const read=p=>JSON.parse(readFileSync(file(p),'utf8'));
const projects=read('data/projects.json');
const stage = process.env.RANKING_STAGE;
const observed=stage ? JSON.parse(readFileSync(stage+'/observed.json','utf8')) : read('data/observed.json');
if (!stage) mkdirSync(file('public'),{recursive:true});
for(const [name,snapshot] of [['demo',demo(projects)],['observed',observed]]){
  if (stage && name === 'demo') continue;
  const {rows,mode,eligible}=rank(projects,snapshot);
  const current=concentration(rows.flatMap(r=>r.m?.contracts.map(c=>c.tx)??[]));
  const prev=concentration(rows.flatMap(r=>r.m?.contracts.map(c=>c.prevTx)??[]));
  const positive=rows.filter(r=>r.signal);
  const negative=rows.filter(r=>r.g28!=null && r.g28<=0);
  const lines=[
    '# The Invisible NEAR Economy: Is Real Adoption Growing Beneath the Hype?',
    name==='demo'?'> **SYNTHETIC SCENARIO. No measured project or network findings.**':!snapshot?'> **No observed snapshot loaded. The thesis remains untested.**':'> **Observed direct function-call attempts. Signers are not people.**',
    '## Hypothesis',
    'Smaller NEAR deployments can gain repeat signers before attention catches up and broaden the distribution of contract activity. The attention claim requires comparable project-level observations.',
    '## Supporting evidence and project discoveries',
    snapshot?`Scope: ${dateAt(snapshot.end,-56)} to ${dateAt(snapshot.end,-1)} UTC. ${eligible} eligible peers. ${mode}. ${snapshot.provenance}.`:'Run the BigQuery pipeline to populate this section.',
    positive.length?positive.map(r=>`- [${r.name}](${r.source}): ${change(r.g28)} 28d and ${change(r.g7)} 7d; ${r.m.repeat}/${r.m.b28} returning (${pct(r.ret)}); ${r.signal}, ${r.confidence.toLowerCase()} heuristic confidence. ${r.risk}`).join('\n'):'No qualifying signals available.',
    '## Contradictory evidence',
    snapshot?`Tracked top-three share: ${pct(prev.top3)} → ${pct(current.top3)}; HHI: ${prev.hhi?.toFixed(3)??'—'} → ${current.hhi?.toFixed(3)??'—'}. ${current.hhi!=null&&prev.hhi!=null&&current.hhi>=prev.hhi?'HHI did not decline, which cuts against broader distribution in this sample.':'This comparison is scoped to the tracked contracts.'}`:'No measured concentration comparison.',
    negative.length?'Flat or falling signer cohorts: '+negative.map(r=>r.name+' '+change(r.g28)).join('; ')+'.':'No flat or declining cohorts available to report.',
    '## Cohort table',
    '| Deployment | Current 28d | Prior 28d | 7d growth | 28d growth | Returning | Score |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...rows.map(r=>`| [${r.name}](${r.source}) | ${r.m?.a28??'—'} | ${r.m?.b28??'—'} | ${change(r.g7)} | ${change(r.g28)} | ${pct(r.ret)} | ${r.score??'—'} |`),
    '## Method and reproduction',
    `Model ${VERSION}. Run \`npm run report\`. Demo inputs: lib/demo.mjs. Observed inputs: data/observed.json and data/projects.json; see analytics/snapshot.sql and README.md for the extract.`,
    'Count distinct originating signers on direct signed function-call attempts, including failures. Do not add receipts, inner calls, or daily uniques to estimate 28-day users. Repeat share is the adjacent-window overlap divided by prior signers. Compare disjoint UTC windows.',
    'Rank eligible peers (≥50 signers in both 28d windows, ≥10 in prior 7d, at least three comparable pilot peers; benchmarks excluded). Midpoint percentiles: adoption 40% (25% 7d and 75% 28d), returning share 30%, default-branch commit growth 15%, adoption growth minus attention growth 15%. Rescale weights across dimensions with full eligible-cohort coverage.',
    'Sources: [NEAR Public Lakehouse](https://github.com/near/near-public-lakehouse), [NEAR registry](https://github.com/near/ecosystem), [GitHub commits API](https://docs.github.com/en/rest/commits/commits#list-commits). No verified comparable attention feed. Public commits omit private work and are a narrow proxy.',
    '## Limitations and falsification',
    'Signers may be bots, shared relayers or multiple accounts controlled by one person; receiver attribution omits proxy usage and methods differ across apps. Compare contract-specific methods, validate completeness, and rerun after excluding known campaign and automation traffic.',
    'Test two subsequent non-overlapping 28-day windows. Drop a candidate if growth reverses, repeat share drops below 25%, or results vanish with attribution controls. Reject diversification if top-three share and HHI do not decline over those windows. Require comparable public attention coverage before testing the hype claim.',
    '## NEAR value capture',
    'Application usage can increase demand for blockspace. It does not quantify token value capture. Compare network gas charges separately from app revenue, issuance, contract rewards, and net burn; verify protocol accounting before making a supply or valuation claim.'
  ];
  writeFileSync(stage ? pathToFileURL(stage+'/thesis-observed.md') : file('public/thesis-'+name+'.md'),lines.join('\n\n')+'\n');
}
