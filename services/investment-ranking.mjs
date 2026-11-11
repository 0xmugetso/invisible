const dexScreener = 'https://api.dexscreener.com/tokens/v1/near/';
export const investmentWeights = {activity:70, poolLiquidity:20, circulatingValuationShare:10};
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const percentile = (values, value) =>
  values.reduce((sum, peer)=>sum+(peer<value ? 1 : peer===value ? .5 : 0),0)/values.length;

async function fetchPools(accounts) {
  const response = await fetch(dexScreener+accounts.map(encodeURIComponent).join(','),{signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error('Pool index HTTP '+response.status);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Invalid pool index response');
  return rows.filter(row=>row.chainId==='near' && positive(row.liquidity?.usd));
}

export async function investmentLeaderboard(board) {
  const accounts = [...new Set(board.projects.flatMap(project=>project.tokens.map(token=>token.accountId)))];
  let pools = [];
  let sourceUnavailable = false;
  const checkedAt = new Date().toISOString();
  try {
    const batches = Array.from({length:Math.ceil(accounts.length/30)},(_,i)=>accounts.slice(i*30,(i+1)*30));
    pools = (await Promise.all(batches.map(fetchPools))).flat();
  } catch {
    sourceUnavailable = true;
  }

  const candidates = board.projects.map(project=>{
    const accountId = project.tokens.length===1 ? project.tokens[0].accountId : null;
    const pool = pools.filter(row=>row.baseToken?.address===accountId)
      .sort((a,b)=>b.liquidity.usd-a.liquidity.usd || a.pairAddress.localeCompare(b.pairAddress))[0];
    const market = pool ? {
      accountId, pairAddress:pool.pairAddress, source:pool.url, checkedAt,
      liquidityUsd:pool.liquidity.usd,
      volume24hUsd:positive(pool.volume?.h24) ? pool.volume.h24 : null,
      marketCapUsd:positive(pool.marketCap) ? pool.marketCap : null,
      fdvUsd:positive(pool.fdv) ? pool.fdv : null,
    } : null;
    const circulatingShare = market?.marketCapUsd && market?.fdvUsd && market.marketCapUsd<=market.fdvUsd
      ? market.marketCapUsd/market.fdvUsd : null;
    const investmentStatus = project.activityRank === null ? 'activity_ineligible'
      : !accountId ? 'primary_token_required'
      : sourceUnavailable ? 'market_source_unavailable'
      : !market ? 'pool_evidence_missing'
      : circulatingShare===null ? 'valuation_evidence_missing' : 'eligible';
    return {...project, market, circulatingShare, investmentStatus, performanceScore:null, performanceRank:null};
  });
  const comparable = candidates.filter(project=>project.investmentStatus==='eligible');
  const depths = comparable.map(project=>project.market.liquidityUsd);
  const ranked = comparable.length<3 ? [] : comparable.map(project=>{
    const investmentComponents = {
      activity:project.activityScore/100,
      poolLiquidity:percentile(depths,project.market.liquidityUsd),
      circulatingValuationShare:project.circulatingShare,
    };
    const performanceScore = Math.round(Object.entries(investmentWeights)
      .reduce((sum,[metric,weight])=>sum+weight*investmentComponents[metric],0)*10)/10;
    return {...project,investmentComponents,performanceScore};
  }).sort((a,b)=>b.performanceScore-a.performanceScore || a.activityRank-b.activityRank);
  const ranks = new Map(ranked.map((project,index)=>[project.id,{...project,performanceRank:index+1,investmentStatus:'ranked'}]));
  return {
    ...board, investmentMethodology:'activity-and-market-v1', investmentWeights, marketCheckedAt:checkedAt,
    performanceRankingStatus:ranked.length ? 'published' : sourceUnavailable ? 'market_source_unavailable' : 'insufficient_comparable_projects',
    projects:candidates.map(project=>ranks.get(project.id) ?? (project.investmentStatus==='eligible'
      ? {...project,investmentStatus:'insufficient_comparable_projects'} : project)),
  };
}
