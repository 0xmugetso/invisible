# INVISIBLE · NEAR research terminal

Discover what’s growing before everyone starts talking about it. INVISIBLE looks for growth and repeat activity on attributed NEAR contracts, then shows the evidence needed to challenge each signal. Built for [NEAR Hackathon Track 2](https://nearhackathon.com/).

```sh
npm ci
npm run dev
# Open http://localhost:3000
npm test
npm run build
```

Node.js 22 recommended. Next.js and TypeScript export a static site to `out/`; use any static host or run `python3 -m http.server 3000 --directory out`. CSS and inline SVG keep the UI dependency-light. No account, wallet, or database is required to run the demo.

**Observed** opens by default and uses the dated BigQuery exports. **Simulation** uses fictional metrics on documented deployments. Public attention is currently unmeasured.

### Walkthrough

1. Open Discovery in Observed mode. The curated project scores and the deployment directory measure different cohorts.
2. Open Research to compare pilot concentration and review the three biggest repeat-signer gains in the deployment export.
3. Follow a contract to see its cohorts, methods and example transactions. The Research page links to the full ranking and downloadable source rows.
4. Open Ecosystem to compare the distribution of transactions across the tracked projects.

### Refresh the research

Install the Google Cloud CLI with `bq`, authenticate with `gcloud auth login`, enable BigQuery in a query project, and make sure your identity can create query jobs. Copy `.env.example` to `.env`, set the project and an exclusive UTC end date at least one day old. The public dataset is in `us-east1`; dry run before export. Google’s [first 1 TiB/month free tier and byte caps](https://cloud.google.com/bigquery/pricing) apply subject to account usage. A dry run can report more bytes than the configured cap; confirm the estimate before increasing the cap.


For a project-local SDK on macOS, add its bin directory to the current shell before signing in. Use an existing project or create one in the BigQuery sandbox.

```sh
export PATH="$PWD/.local/gcloud/google-cloud-sdk/bin:$PATH"
export CLOUDSDK_CONFIG="$PWD/.local/gcloud-config"
gcloud auth login
gcloud projects list --format='table(projectId,name)'
```

```sh
node --env-file=.env scripts/refresh.mjs --dry-run
node --env-file=.env scripts/refresh.mjs
npm run build
```

The SQL returns one JSON payload with project, signer cohort, daily, contract and network aggregates. The exporter checks coverage for 56 days, enriches public GitHub commit counts, hashes the SQL and registry, then atomically updates `data/observed.json`. Rebuild after refresh. A missing GitHub token is fine at low volumes; an inaccessible or truncated repo produces unknown. The published dataset ID and field definitions were verified against the [Lakehouse code](https://github.com/near/near-public-lakehouse/tree/main/src/lakehouse/notebooks). The dry run checks the query against the warehouse schema and reports the estimated bytes before execution.

Before using an observed report as evidence, check the public tables’ freshness and compare indexed volumes with an independent source. For one contract/day, query transaction_actions grouped by transaction hash and signer and reconcile its distinct counts to the snapshot. Spot check hashes in an explorer, check for partial ingestion or high-volume relayers, and check fee charges against an independent chain aggregate. Daily presence alone cannot detect partial ingestion.

### Method

- Each deployment has exact receiver IDs and attribution links in `data/projects.json`. Some are benchmarks rather than app signers (e.g. Intents and Aurora). Two Rhea deployments are separate analysis units. Registry verification is documentary; it does not establish whether a deployment is currently in use.
- Count direct signed function-call attempts, including failures. Deduplicate by transaction and signer. No internal receipts, delegate actions or proxy routing are attributed. Signers are accounts and may be shared or automated. Read-only calls and indirect actions are outside scope.
- Compare adjacent 7- and 28-day windows. Return rate is the share of prior 28-day signers also seen in the current window. Growth against zero is undefined. The scoring model is an exploratory ranking within a small cohort, not a prediction.
- HHI and top-three shares use tracked contract transaction counts. Gas charges, when available, add transaction conversion and receipt execution amounts in NEAR, deduplicated by stage and outcome identifier. These are an accounting proxy, not net burn, revenue or proof of token value capture. Missing amounts remain unknown.
- Reports are generated from the same snapshots and scoring functions as the UI. Run `npm run report` to reproduce the Markdown in `public/`.

Observed mode opens by default. The NearBlocks panels refresh recent blocks and contract transactions every 30 seconds while visible. These samples are separate from the historical adoption score. The discovery page can show a dated saved block sample if a live refresh fails.

To collect the separate repeat-signer study, run `node --env-file=.env scripts/nearblocks-evidence.mjs` and rebuild. Set `NEARBLOCKS_API_KEY` in that file for authenticated throughput and optionally `NEARBLOCKS_PAGE_CAP` (default 8, maximum 200). The collector compares three 28-day UTC windows, lists methods called by repeat signers, and records how many returned in the third window. It counts successful direct calls and excludes `epoch_` methods. Failed or capped histories remain unavailable. This study does not replace the BigQuery adoption snapshot.

The deployment directory uses `analytics/deployments.sql`. It includes every account observed receiving a direct function call attempt or deployment-related action in three 28-day windows. Contract rankings and the curated project rankings use separate peer groups. The directory shows repeat signer gains between adjacent window pairs, how many earlier repeat signers appeared in the third window, and decoded methods with transaction examples. Historical deployments with no qualifying action during the window and contracts seen only in indirect receipts fall outside this export.

```sh
node --env-file=.env scripts/deployments.mjs --dry-run
node --env-file=.env scripts/deployments.mjs
npm run build
```

Set a separate `BQ_MAX_BYTES` for this query after reviewing its dry-run estimate. The deployment export defaults to a 120 GB cap when no override is set.

### Live dashboard

Discovery polls NearBlocks every 30 seconds while the tab is visible. The panel shows the latest indexed block time and keeps the last available sample if an update fails.

Observed rankings use complete UTC days. Open tabs check `/rankings/current.json` once a minute and load a new release without rebuilding. Each release contains matching project rankings, contract data, and the observed report.

With the BigQuery CLI authenticated and `BQ_PROJECT` configured, run:

```sh
node --env-file=.env scripts/live-rankings.mjs          # refresh once
node --env-file=.env scripts/live-rankings.mjs --watch  # refresh now and daily at 06:00 UTC
```

The watcher runs only while the process is running. It leaves one complete UTC day for ingestion and publishes only after both exports and the report succeed. Set `BQ_PROJECT_MAX_BYTES` and `BQ_DEPLOYMENT_MAX_BYTES` to control per-query scan limits. Defaults are 35 GB and 130 GB respectively. For static hosting, serve the new release files before updating `rankings/current.json`.

To publish the existing matching exports without running BigQuery, use `node scripts/live-rankings.mjs --publish-existing`.

### PostgreSQL Activity service

Set up a PostgreSQL 14+ database and put its connection string in `DATABASE_URL` in your local `.env`. The worker is the only component that needs that connection string, the BigQuery credentials, or the NearBlocks key.

| Input | Storage and use |
| --- | --- |
| Project names, websites, social accounts and their sources | `project`, `project_link` |
| Verified project contract mappings and NEAR token accounts | `project_contract`, `project_token` |
| BigQuery `transaction_actions` and NearBlocks account transactions | `direct_call`, keyed by transaction hash. Same receiver, signer, UTC time and decoded method representation for both feeds. NearBlocks can also supply execution status. |
| Completed imports and latest blocks | `call_coverage`, `live_block` |
| Published scores and evidence per six-hour cutoff | `ranking_run` |

Prepare the following before starting the worker:

1. A PostgreSQL database and a worker host that can write to the dashboard's data directory.
2. An authenticated `bq` CLI, a query project in `BQ_PROJECT`, and a scan limit in `BQ_HISTORY_MAX_BYTES`. The importer scans one UTC partition per data query. Confirm an uninterrupted range and enough query budget before backfilling.
3. A NearBlocks key in `NEARBLOCKS_API_KEY` for the contract ingestion workload. The public endpoint can serve the block feed. Account ingestion must reach the saved watermark before it records coverage, so provider quotas and the page cap determine how far it can catch up.
4. A registry of project identities, official links, mapped NEAR contracts and evidence for each token account. The starter file covers Rhea Finance, Meta Pool and LiNEAR. Copy and expand it, then set `ACTIVITY_REGISTRY` to its path. Seed at least three projects that qualify on signer volume. The starter is not a network-wide ranking.

```sh
node --env-file=.env services/activity.mjs setup
node --env-file=.env services/activity.mjs backfill START_UTC_DATE END_UTC_DATE
node --env-file=.env services/activity.mjs watch
```

Replace the date arguments with ISO dates spanning at least 56 complete UTC days. The exclusive end must be before today's UTC date and close enough to the current cutoff for NearBlocks to bridge the gap. The BigQuery importer checks for both the requested and following partitions, and skips ranges already recorded as covered. Partition presence is an ingestion check and cannot prove that upstream indexing is gap-free. NearBlocks uses a 30-minute overlap on each update and a 15-minute delay after the ranking cutoff.

The worker checks blocks every 30 seconds and produces rankings for 00:00, 06:00, 12:00 and 18:00 UTC. It writes `activity/blocks.json` and `activity/rankings.json` under `public/` and the existing `out/` export. Serve those outputs from the dashboard origin. Run one worker per database and output location. The browser checks for published recommendations every minute and can still read blocks directly from NearBlocks when the database feed is unavailable.

The ranking requires 50 signers in each 28-day window and 10 in the preceding seven-day comparison window. The score uses peer percentiles for returning share (40%), 28-day signer growth (40%) and days with activity (20%). Fastest rising uses positive seven-day signer growth. It counts direct function-call attempts, including failures, with a signer counted once per project per window. Ranking history records the cutoff, methodology and evidence hashes. If ingestion fails or there is insufficient comparable coverage, the worker retains the previous published rankings.

### Vercel cron

Use the repository root and the build settings in `vercel.json`. It deploys the static Next.js export and two Node functions. Four daily cron entries call `/api/refresh-activity` in the 00:00, 06:00, 12:00, and 18:00 UTC hours. Each entry has a distinct slot query parameter. Vercel Hobby can invoke each entry any time within its scheduled hour.

Set `CRON_SECRET`, `DATABASE_URL`, and `BQ_PROJECT` in the production environment. Use a random cron secret. For keyless BigQuery access, follow the [Vercel Google Cloud federation guide](https://vercel.com/docs/oidc/gcp). Use the team issuer and allowed audience `https://vercel.com/TEAM_SLUG`, map `google.subject` to `assertion.sub`, and restrict the provider with `assertion.sub == 'owner:TEAM_SLUG:project:invisible:environment:production'`. Grant that exact subject Workload Identity User on the service account. The service account needs BigQuery Job User on the query project. Enable the BigQuery, Security Token Service, and IAM Service Account Credentials APIs in Google Cloud.

Set `BQ_WIF_PROVIDER` to `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID` and `BQ_SERVICE_ACCOUNT_EMAIL` to the service account email. Vercel supplies a short-lived token to each cron invocation. An existing key-based setup can use `BQ_CREDENTIALS_JSON` when the federation variables are absent.

Set `NEARBLOCKS_API_KEY` for recent account samples and optionally `BQ_PROJECT_MAX_BYTES` for the ranking scan cap. The cron uses the BigQuery API.

Run the database setup before the first scheduled run. The cron finds the latest complete 56-day warehouse window with a following partition present. BigQuery computes signer cohorts across that window and returns one summary per verified project. PostgreSQL stores the summaries, scores, and transaction evidence alongside the project registry. The cutoff advances when the next complete UTC day is available. NearBlocks supplies recent activity independently of that cutoff.
