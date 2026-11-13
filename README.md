<p align="center">
  <a href="https://invisible-gray.vercel.app/">
    <img src="public/brand/readme-hero.png" alt="Invisible — On-chain research for the NEAR ecosystem" width="100%">
  </a>
</p>

# Invisible

**Research NEAR projects from the contracts people actually use.** Invisible compares activity across two 28-day windows, shows which signing accounts came back, and links project scores to the on-chain and market evidence behind them. Analysts can inspect the dashboard, and agents can query the same research through MCP, REST, or A2A.

[Open dashboard](https://invisible-gray.vercel.app/app/) · [Read the docs](https://invisible-gray.vercel.app/docs/) · [Connect an agent](https://invisible-gray.vercel.app/#connect) · [View roadmap](https://invisible-gray.vercel.app/#roadmap)

[Features](#features) · [Methodology](#methodology) · [Agent setup](#agent-setup) · [Local setup](#local-setup) · [Deployment](#deployment)

---

<a href="https://invisible-gray.vercel.app/app/"><img src="public/dashboard-walkthrough.webp" width="100%" alt="Invisible overview with NEAR project metrics, the leaderboard, and signer activity charts"></a>

## Features

| Feature | What you can do |
| --- | --- |
| [Overview](https://invisible-gray.vercel.app/app/) | Scan verified-token coverage, ranking eligibility, and the largest measured returning-signer cohort. Select a project to compare signer counts, returning share, turnover, and score contributions. |
| [Leaderboard](https://invisible-gray.vercel.app/app/discovery/) | Compare on-chain activity or switch to the investment ranking for projects with comparable market data. Open a project’s evidence to see why it qualified and which inputs affected its score. |
| [Project evidence](https://invisible-gray.vercel.app/docs/#evidence) | Inspect mapped contracts, example transactions, market source and observation date, and published tokenomics or vesting terms where available. |
| [Deployment explorer](https://invisible-gray.vercel.app/app/deployments/) | Search NEAR contract accounts or browse project mappings. Inspect example calls and measured signer cohorts alongside a saved mainnet block sample. |
| [Ecosystem](https://invisible-gray.vercel.app/app/ecosystem/) | Compare changes in signer participation and contract volume across tracked projects. Review the indexed network gas series when coverage is complete. |
| [Signer forecast](https://invisible-gray.vercel.app/app/discovery/?data=forecast) | Compare a cohort-based estimate with a flat baseline. When a third complete window exists, see how both estimates performed against observed activity. |
| [NEAR wallet access](https://invisible-gray.vercel.app/docs/#dashboard) | Connect Meteor or another supported NEAR wallet through HOT Connect and sign a message to open your profile. Copy your address, open it in NearBlocks, or disconnect from the header. |

| Deployment explorer | Signer forecast |
| --- | --- |
| ![NEAR contract explorer with mainnet activity](public/guide/deployments.webp) | ![Forecast with measured cohorts, a flat baseline, and historical error](public/guide/forecast.webp) |

## Methodology

Invisible counts distinct NEAR signing accounts that directly attempted a function call to a mapped product contract. A returning signer appears in both adjacent 28-day UTC windows. The same account is counted once per project per window, even if it used several of that project’s contracts. Relayers, automation, and multiple accounts affect the interpretation of signer counts.

| Ranking | Inputs |
| --- | --- |
| **Activity** | 35% adjusted return rate, 30% returning signers, 25% adjusted signer growth, and 10% activity spread across days. |
| **Investment** | 70% activity, 20% pool liquidity, and 10% market cap as a share of fully diluted valuation. Comparable market evidence is required. |

The activity leaderboard requires a verified token, 50 signers in each 28-day window, 10 in the prior weekly window, 10 returning signers, and activity on at least 14 days in the latest window. Projects outside the ranking cohort can still appear in project coverage.

The [NEAR Public Lakehouse](https://github.com/near/near-public-lakehouse) supplies indexed history, [NearBlocks](https://nearblocks.io/) supplies recent samples and transaction links, and [DEX Screener](https://dexscreener.com/near) supplies pool and valuation evidence. [Full methodology](https://invisible-gray.vercel.app/docs/#investment-methodology) · [Data sources](https://invisible-gray.vercel.app/docs/#sources)

## Agent setup

| Interface | Start here |
| --- | --- |
| **MCP** | Use Streamable HTTP at `https://invisible-gray.vercel.app/api/mcp`. See setup for [Claude Code, Cursor, Codex, and Antigravity](https://invisible-gray.vercel.app/docs/#mcp). |
| **REST** | Request JSON from `/api/v1/`. See the [endpoint reference and examples](https://invisible-gray.vercel.app/docs/#rest). |
| **A2A** | Read the [agent card](https://invisible-gray.vercel.app/.well-known/agent-card.json), then send a JSON-RPC `message/send` request to `/api/a2a`. See the [request example](https://invisible-gray.vercel.app/docs/#a2a). |
| **Agent skill** | Install [SKILL.md](https://invisible-gray.vercel.app/skill/SKILL.md) for guidance on researching projects and citing evidence. See the [installation instructions](https://invisible-gray.vercel.app/docs/#skill). |

<details open>
<summary><strong>Connect with MCP</strong></summary>

```sh
# Codex
codex mcp add invisible --url https://invisible-gray.vercel.app/api/mcp

# Claude Code
claude mcp add --transport http invisible https://invisible-gray.vercel.app/api/mcp
```

Try asking **“Which NEAR projects brought the most signers back? Show me the evidence.”**

- `search_projects` finds projects by name, ID, or contract.
- `get_project_evidence` reads mapped deployments, signer cohorts, and available tokenomics for a verified project ID.
- `get_rankings` reads activity, investment, or returning-signer rankings and their cutoff.

</details>

<details>
<summary><strong>Try the REST API</strong></summary>

```sh
curl -fsS 'https://invisible-gray.vercel.app/api/v1/returning-signers?limit=10'
curl -fsS 'https://invisible-gray.vercel.app/api/v1/projects/rhea'
curl -fsS 'https://invisible-gray.vercel.app/api/v1/projects/rhea/market'
```

</details>

## Local setup

1. Install Node.js 22 or later and npm.
2. Clone the repository and install its dependencies.

   ```sh
   git clone https://github.com/0xmugetso/invisible.git
   cd invisible
   npm ci
   npm run dev
   ```

3. Open [localhost:3000](http://localhost:3000/). The Next.js dev server serves the landing page and docs and proxies selected research requests to the public deployment. To try wallet sign-in immediately, use the [live dashboard](https://invisible-gray.vercel.app/app/).

Run `npm test` for the test suite or `npm run build` to generate the static export in `out/`.

## Deployment

The production Vercel project serves the static Next.js export and the Node functions in [`api/`](api/). See [`vercel.json`](vercel.json) for the build, routing, and cron configuration.

1. Provision PostgreSQL and set `DATABASE_URL`. Apply [`analytics/postgres.sql`](analytics/postgres.sql) and apply the production wallet schema from the current deployment source.
2. Set the deployment’s public origin and provider credentials using [`.env.example`](.env.example) as a reference. Keep database, cron, and provider credentials on the server.
3. Configure the research refresh below. Wallet sign-in verifies a single-use NEP-413 message against a current full-access key on NEAR mainnet and stores a database session.

### Scheduled research refresh

Use the repository root and the build settings in `vercel.json`. It deploys the static Next.js export and Node API functions. Four daily cron entries call `/api/refresh-activity` in the 00:00, 06:00, 12:00, and 18:00 UTC hours. Each entry has a distinct slot query parameter.

Set `CRON_SECRET`, `DATABASE_URL`, and `BQ_PROJECT` in the production environment. Use a random cron secret. For keyless BigQuery access, follow the [Vercel Google Cloud federation guide](https://vercel.com/docs/oidc/gcp). Use the team issuer and allowed audience `https://vercel.com/TEAM_SLUG`, map `google.subject` to `assertion.sub`, and restrict the provider with `assertion.sub == 'owner:TEAM_SLUG:project:invisible:environment:production'`. Grant that exact subject Workload Identity User on the service account. The service account needs BigQuery Job User on the query project. Enable the BigQuery, Security Token Service, and IAM Service Account Credentials APIs in Google Cloud.

Set `BQ_WIF_PROVIDER` to `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID` and `BQ_SERVICE_ACCOUNT_EMAIL` to the service account email. Vercel supplies a short-lived token to each cron invocation. An existing key-based setup can use `BQ_CREDENTIALS_JSON` when the federation variables are absent.

Set `NEARBLOCKS_API_KEY` for recent account samples and optionally `BQ_PROJECT_MAX_BYTES` for the ranking scan cap. The cron uses the BigQuery API.

Run the database setup before the first scheduled run. The cron finds the latest complete 56-day warehouse window with a following partition present. BigQuery computes signer cohorts across that window for mapped projects. Each summary includes the exact receiver accounts used, a signer breakdown per contract, and transaction links. PostgreSQL stores these summaries alongside the project registry. Signers are deduplicated at the project level, so per-contract totals cannot be added together. Projects without a verified token can have measured activity in Project coverage and are ineligible for either leaderboard. The cutoff advances when the next complete UTC day is available. NearBlocks supplies recent activity independently of that cutoff.

## Brand assets

[Keyhole mark](app/icon.svg) · [README banner](public/brand/readme-hero.png) · [Social banner · 1200 × 630](public/brand/social-hero.png) · [Dashboard walkthrough](public/dashboard-walkthrough.mp4)
