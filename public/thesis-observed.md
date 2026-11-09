# The Invisible NEAR Economy: Is Real Adoption Growing Beneath the Hype?

> **Observed direct function-call attempts. Signers are not people.**

## Hypothesis

Smaller NEAR deployments can gain repeat signers before attention catches up and broaden the distribution of contract activity. The attention claim requires comparable project-level observations.

## Supporting evidence and project discoveries

Scope: 2026-09-11 to 2026-11-05 UTC. 5 eligible peers. Adoption Discovery Score. NEAR Public BigQuery (us-east1) · SQL SHA-256 4e130520927e3fe7.

No qualifying signals available.

## Contradictory evidence

Tracked top-three share: 92% → 95%; HHI: 0.409 → 0.331. This comparison is scoped to the tracked contracts.

Flat or falling signer cohorts: Rhea Lending -48%; Rhea Exchange -65%; NEAR Social -45%; Meta Pool -66%; LiNEAR -74%; Aurora Engine -67%; NEAR Intents -62%; Wrapped NEAR -8%.

## Cohort table

| Deployment | Current 28d | Prior 28d | 7d growth | 28d growth | Returning | Score |

|---|---:|---:|---:|---:|---:|---:|

| [Rhea Lending](https://github.com/near/ecosystem/blob/main/entities.json) | 1873 | 3577 | +44% | -48% | 16% | 79 |

| [Rhea Exchange](https://github.com/ref-finance/guide/blob/main/developers/contracts.md) | 1651 | 4701 | +22% | -65% | 14% | 59 |

| [NEAR Social](https://github.com/NearSocial/social-db) | 58 | 106 | +182% | -45% | 5% | 56 |

| [Meta Pool](https://docs.metapool.app/master/for-developers/meta-pool-contracts/near-network) | 210 | 617 | -2% | -66% | 8% | 39 |

| [LiNEAR](https://github.com/linear-protocol/LiNEAR) | 102 | 391 | -11% | -74% | 5% | 19 |

| [Aurora Engine](https://github.com/aurora-is-near/aurora-engine) | 191 | 576 | -27% | -67% | 11% | — |

| [NEAR Intents](https://docs.near-intents.org/integration/verifier-contract/account-abstraction) | 4016 | 10481 | +23% | -62% | 4% | — |

| [Sputnik DAO](https://github.com/near-daos/sputnik-dao-ui) | 0 | 0 | — | — | — | — |

| [Sweat Economy](https://github.com/wormhole-foundation/wormhole-token-list/blob/main/content/dest_ethereum.md) | 836 | 646 | -38% | +29% | 21% | — |

| [Wrapped NEAR](https://github.com/rhea-finance/rhea-sdk-docs/blob/main/CrossChainDexAPI.md) | 26058 | 28370 | -28% | -8% | 19% | — |

## Method and reproduction

Model 1.0. Run `npm run report`. Demo inputs: lib/demo.mjs. Observed inputs: data/observed.json and data/projects.json; see analytics/snapshot.sql and README.md for the extract.

Count distinct originating signers on direct signed function-call attempts, including failures. Do not add receipts, inner calls, or daily uniques to estimate 28-day users. Repeat share is the adjacent-window overlap divided by prior signers. Compare disjoint UTC windows.

Rank eligible peers (≥50 signers in both 28d windows, ≥10 in prior 7d, at least three comparable pilot peers; benchmarks excluded). Midpoint percentiles: adoption 40% (25% 7d and 75% 28d), returning share 30%, default-branch commit growth 15%, adoption growth minus attention growth 15%. Rescale weights across dimensions with full eligible-cohort coverage.

Sources: [NEAR Public Lakehouse](https://github.com/near/near-public-lakehouse), [NEAR registry](https://github.com/near/ecosystem), [GitHub commits API](https://docs.github.com/en/rest/commits/commits#list-commits). No verified comparable attention feed. Public commits omit private work and are a narrow proxy.

## Limitations and falsification

Signers may be bots, shared relayers or multiple accounts controlled by one person; receiver attribution omits proxy usage and methods differ across apps. Compare contract-specific methods, validate completeness, and rerun after excluding known campaign and automation traffic.

Test two subsequent non-overlapping 28-day windows. Drop a candidate if growth reverses, repeat share drops below 25%, or results vanish with attribution controls. Reject diversification if top-three share and HHI do not decline over those windows. Require comparable public attention coverage before testing the hype claim.

## NEAR value capture

Application usage can increase demand for blockspace. It does not quantify token value capture. Compare network gas charges separately from app revenue, issuance, contract rewards, and net burn; verify protocol accounting before making a supply or valuation claim.
