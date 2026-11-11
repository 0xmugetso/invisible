import {activityThresholds, unmetActivityThresholds} from './activity-eligibility.mjs';
import registry from '../data/activity-registry.json' with {type:'json'};
import catalog from '../data/ecosystem-catalog.json' with {type:'json'};
import reviewed from '../data/project-research.json' with {type:'json'};

const nearBlocks = 'https://api.nearblocks.io/v3';
const coinGecko = 'https://api.coingecko.com/api/v3';
const byId = new Map(registry.map(project => [project.id, project]));
const byToken = new Map(registry.flatMap(project => project.tokens.map(token => [token.accountId, project])));
const sharedAsset = /(?:^|\.)(?:factory\.bridge\.near|omft\.near|contract\.portalbridge\.near)$/;

async function request(url, headers) {
  const response = await fetch(url, {headers, signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error('Upstream HTTP '+response.status);
  return response.json();
}

function nearBlocksRequest(path) {
  const key = process.env.NEARBLOCKS_API_KEY;
  return request(nearBlocks+path, key ? {Authorization:'Bearer '+key} : undefined);
}

function decimal(value) {
  return /^\d+(?:\.\d+)?$/.test(String(value ?? '')) ? String(value) : null;
}

export async function discoverTokenCandidates(cursor) {
  const params = new URLSearchParams({limit:'100'});
  if (cursor) params.set('next', cursor);
  const page = await nearBlocksRequest('/fts?'+params);
  if (!Array.isArray(page.data)) throw new Error('Invalid NearBlocks token page');
  return {
    source: nearBlocks+'/fts',
    checkedAt: new Date().toISOString(),
    nextCursor: page.meta?.next_page ?? null,
    candidates: page.data.map(token => {
      const project = byToken.get(token.contract);
      let status = 'needs_project_attribution';
      if (project) status = project.benchmark ? 'reference_project' : 'verified_project';
      else if (token.contract === 'wrap.near' || sharedAsset.test(token.contract)) status = 'shared_or_bridged_asset_review';
      return {
        accountId:token.contract, name:token.name, symbol:token.symbol, status,
        projectId:project?.id ?? null, holders:decimal(token.holders),
        transfers:decimal(token.transfers),
        source:'https://nearblocks.io/tokens/'+encodeURIComponent(token.contract),
      };
    }),
  };
}

export function researchEcosystem(page, query = '') {
  const size = 100;
  const start = (page - 1) * size;
  const term = query.toLowerCase();
  const matching = catalog.projects.filter(project => [project.name, project.id, ...project.reportedContracts,
    ...(project.reportedTokens ?? []).map(token=>token.accountId)].some(value=>value.toLowerCase().includes(term)));
  return {
    total:matching.length,
    collectedAt:catalog.collectedAt, sources:catalog.sources, deploymentCutoff:catalog.deploymentCutoff, page,
    counts:Object.fromEntries(Object.entries(Object.groupBy(catalog.projects, project=>project.status))
      .map(([status,projects])=>[status,projects.length])),
    nextPage:start+size < matching.length ? page+1 : null,
    projects:matching.slice(start,start+size),
  };
}

export async function researchNarratives() {
  const source = coinGecko+'/search/trending';
  const {categories} = await request(source);
  if (!Array.isArray(categories)) throw new Error('Invalid market attention response');
  return {
    source, checkedAt:new Date().toISOString(), signal:'coingecko_search_trends',
    categories:categories.map((category,index) => ({
      position:index+1, name:category.name, id:category.id, slug:category.slug ?? null,
    })),
  };
}

async function marketEvidence(token) {
  const path = '/fts/'+encodeURIComponent(token.accountId);
  const checkedAt = new Date().toISOString();
  const {data} = await nearBlocksRequest(path);
  if (data?.contract !== token.accountId) throw new Error('Token contract mismatch');
  const market = {
    status:'reported', checkedAt, source:nearBlocks+path,
    priceUsd:decimal(data.price), volume24hUsd:decimal(data.volume_24h),
    marketCapUsd:decimal(data.market_cap), fullyDilutedValuationUsd:decimal(data.fully_diluted_market_cap),
    circulatingSupply:decimal(data.circulating_supply), totalSupplyOnNear:decimal(data.total_supply),
    marketCapRank:null, marketCapRankSource:null, maxSupply:null,
  };
  // Follow the indexer's contract-to-market ID mapping, never ticker matches.
  if (typeof data.coingecko_id === 'string' && /^[a-z0-9-]+$/.test(data.coingecko_id)) {
    const params = new URLSearchParams({vs_currency:'usd', ids:data.coingecko_id});
    try {
      const rows = await request(coinGecko+'/coins/markets?'+params);
      const quote = rows.find(row => row.id === data.coingecko_id);
      if (quote) {
        market.marketCapRank = Number.isSafeInteger(quote.market_cap_rank) && quote.market_cap_rank > 0 ? quote.market_cap_rank : null;
        market.maxSupply = decimal(quote.max_supply);
        market.marketCapRankSource = {url:coinGecko+'/coins/markets?'+params, updatedAt:quote.last_updated ?? null};
      }
    } catch {
      // The NearBlocks quote remains available if CoinGecko is rate-limited.
    }
  }
  return market;
}

function projectSummary(project, snapshot, rank) {
  const activity = snapshot?.analysis?.find(row => row.project_id === project.id) ?? null;
  return {
    id:project.id, name:project.name, tokens:project.tokens,
    status:!project.tokens.length ? 'research_only' : project.benchmark ? 'reference'
      : rank ? 'ranked' : activity ? (unmetActivityThresholds(activity).length ? 'below_ranking_thresholds' : 'awaiting_comparable_cohort') : 'awaiting_measurement',
    activityRank:rank?.rank ?? null, activityScore:rank?.score ?? null,
    performanceRank:null,
    activity,
    scoreComponents:rank?.components ?? null,
    unmetThresholds:activity ? unmetActivityThresholds(activity) : [],
  };
}

export function researchLeaderboard(snapshot) {
  const eligible = registry.filter(project => project.tokens.length > 0);
  const tokenProjectIds = new Set(eligible.map(project => project.id));
  const ranked = (snapshot?.highestRanked ?? []).filter(row => tokenProjectIds.has(row.project_id) &&
    !byId.get(row.project_id).benchmark && !unmetActivityThresholds(row).length);
  const ranks = new Map(ranked.map((row,index) => [row.project_id, {rank:index+1, score:row.score, components:row.components}]));
  return {
    version:1,
    rankingScope:'verified_token_project_activity',
    scoreBasis:'Relative onchain activity among qualified token projects',
    performanceRankingStatus:'awaiting_evidence',
    cutoff:snapshot?.cutoff ?? null,
    methodology:snapshot?.methodology ?? null,
    weights:snapshot?.weights ?? null,
    thresholds:activityThresholds,
    coverage:{catalogEntries:catalog.projects.length, reviewPending:catalog.projects.filter(project=>project.status==='needs_product_review').length},
    projects:eligible.map(project => projectSummary(project, snapshot, ranks.get(project.id)))
      .sort((a,b) => (a.activityRank ?? Infinity) - (b.activityRank ?? Infinity) || a.id.localeCompare(b.id)),
  };
}

export async function researchProject(id, snapshot) {
  const project = byId.get(id);
  if (!project) return null;
  const row = researchLeaderboard(snapshot).projects.find(item => item.id === id) ?? projectSummary(project, snapshot);
  const tokens = await Promise.all(project.tokens.map(async token => {
    try {
      return {...token, market:await marketEvidence(token)};
    } catch {
      return {...token, market:{status:'unavailable', source:nearBlocks+'/fts/'+encodeURIComponent(token.accountId)}};
    }
  }));
  const evidence = reviewed[id];
  const tokenomics = project.tokens.some(token => token.accountId === evidence?.tokenAccount) ? evidence : {};
  return {
    ...row, tokens, contracts:project.contracts, links:project.links,
    cutoff:snapshot?.cutoff ?? null,
    tokenomics:{
      status:project.tokens.length ? 'verified_token' : 'token_not_verified',
      tokenAccount:tokenomics.tokenAccount ?? null, stage:tokenomics.stage ?? null, vesting:tokenomics.vesting ?? null,
      upcomingUnlocks:tokenomics.upcomingUnlocks ?? null, burns:tokenomics.burns ?? null, buybacks:tokenomics.buybacks ?? null,
    },
    roadmap:tokenomics.roadmap ?? null,
    socialActivity:null,
    narrativeMomentum:null,
  };
}
