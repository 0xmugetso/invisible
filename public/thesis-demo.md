# The Invisible NEAR Economy: Is Real Adoption Growing Beneath the Hype?

> **SYNTHETIC SCENARIO. No measured project or network findings.**

## Hypothesis

Smaller NEAR deployments can gain repeat signers before attention catches up and broaden the distribution of contract activity. The attention claim requires comparable project-level observations.

## Supporting evidence and project discoveries

Scope: 2026-09-06 to 2026-10-31 UTC. 6 eligible peers. Adoption Discovery Score. Synthetic reference scenario v1.

- [LiNEAR](https://github.com/linear-protocol/LiNEAR): +80% 28d and +75% 7d; 310/700 returning (44%); Adoption signal, moderate heuristic confidence. Staking and transfers share a receiver. Deposits can cluster around incentives.
- [Meta Pool](https://docs.metapool.app/master/for-developers/meta-pool-contracts/near-network): +45% 28d and +34% 7d; 370/1010 returning (37%); Adoption signal, moderate heuristic confidence. This covers stNEAR only, not Meta Pool’s multichain footprint.
- [NEAR Social](https://github.com/NearSocial/social-db): +50% 28d and +31% 7d; 180/560 returning (32%); Adoption signal, moderate heuristic confidence. Writes measure activity on this datastore; reads and offchain engagement are invisible.

## Contradictory evidence

Tracked top-three share: 73% → 73%; HHI: 0.238 → 0.235. This comparison is scoped to the tracked contracts.

Flat or falling signer cohorts: Rhea Lending -13%; Wrapped NEAR -8%.

## Cohort table

| Deployment | Current 28d | Prior 28d | 7d growth | 28d growth | Returning | Score |

|---|---:|---:|---:|---:|---:|---:|

| [LiNEAR](https://github.com/linear-protocol/LiNEAR) | 1260 | 700 | +75% | +80% | 44% | 92 |

| [Meta Pool](https://docs.metapool.app/master/for-developers/meta-pool-contracts/near-network) | 1460 | 1010 | +34% | +45% | 37% | 63 |

| [NEAR Social](https://github.com/NearSocial/social-db) | 840 | 560 | +31% | +50% | 32% | 58 |

| [Rhea Exchange](https://github.com/ref-finance/guide/blob/main/developers/contracts.md) | 4320 | 3950 | +7% | +9% | 37% | 53 |

| [Rhea Lending](https://github.com/near/ecosystem/blob/main/entities.json) | 1900 | 2180 | -8% | -13% | 29% | 17 |

| [Sputnik DAO](https://github.com/near-daos/sputnik-dao-ui) | 130 | 125 | -7% | +4% | 27% | 16 |

| [Aurora Engine](https://github.com/aurora-is-near/aurora-engine) | 520 | 465 | +12% | +12% | 41% | — |

| [NEAR Intents](https://docs.near-intents.org/integration/verifier-contract/account-abstraction) | 3300 | 2900 | +8% | +14% | 46% | — |

| [Sweat Economy](https://github.com/wormhole-foundation/wormhole-token-list/blob/main/content/dest_ethereum.md) | 8300 | 7310 | +9% | +14% | 48% | — |

| [Wrapped NEAR](https://github.com/rhea-finance/rhea-sdk-docs/blob/main/CrossChainDexAPI.md) | 910 | 985 | -2% | -8% | 25% | — |

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
