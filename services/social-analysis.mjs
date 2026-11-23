const DAY = 86400000;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const rounded = value => Math.round(value * 10) / 10;
const median = values => {
  if (!values.length) return null;
  const sorted = values.toSorted((a,b)=>a-b);
  const mid = Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
};

export const socialMethodology = {
  version:'social-publishing-v1',
  sample:'Up to 30 latest dated public posts per official platform. Duplicate URLs are counted once.',
  weights:{recency:40, cadence:30, continuity:30},
  meaning:'Publishing activity on each platform. This measures communication, not community quality, investment merit, sentiment, or verified product delivery.',
  scoring:'Recency decays linearly from 40 to 0 over 30 days. Cadence reaches 30 at 8 posts in the last 30 days. Continuity contributes 7.5 per active trailing week, capped at 30.',
  eligibility:'At least 5 dated posts and a complete requested sample, or evidence that the returned timeline reaches at least 30 days back. Future-dated posts are rejected.',
  engagement:'Median likes, replies, reposts, and views are reported only where actually returned. Engagement is excluded from the score.',
};

export function analyzeSocialSource(source, observedAt) {
  const now = Date.parse(observedAt);
  if (!Number.isFinite(now)) throw new Error('Invalid observation time');
  const seen = new Set();
  const posts = (source.posts ?? []).filter(post => {
    const stamp = Date.parse(post.publishedAt);
    let url;
    try { url=new URL(post.url); } catch { return false; }
    if (url.protocol!=='https:' || !Number.isFinite(stamp) || stamp>now || seen.has(url.href)) return false;
    seen.add(url.href);
    return true;
  }).toSorted((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,30);
  const recent = posts.filter(post=>now-Date.parse(post.publishedAt)<30*DAY);
  const ageDays = posts.length ? (now-Date.parse(posts[0].publishedAt))/DAY : null;
  const weeks = new Set(recent.filter(post=>now-Date.parse(post.publishedAt)<28*DAY)
    .map(post=>Math.floor((now-Date.parse(post.publishedAt))/(7*DAY))));
  const complete = posts.length===30;
  const reachesWindow = posts.length>0 && now-Date.parse(posts.at(-1).publishedAt)>=30*DAY;
  const eligible = source.status==='collected' && posts.length>=5 && (complete || reachesWindow);
  const contributions = eligible ? {
    recency:rounded(40*Math.max(0,1-ageDays/30)),
    cadence:rounded(30*Math.min(1,recent.length/8)),
    continuity:weeks.size*7.5,
  } : null;
  const score = contributions ? rounded(Object.values(contributions).reduce((sum,value)=>sum+value,0)) : null;
  const engagement = Object.fromEntries(['likes','replies','reposts','views'].map(metric=>{
    const values=posts.map(post=>post.metrics?.[metric]).filter(value=>finite(value)&&value>=0);
    return [metric,{median:median(values),measuredPosts:values.length}];
  }));
  const contentRules={
    product:/\b(launch(?:ed)?|release[ds]?|upgrade[ds]?|mainnet|integrat(?:ion|ed)|audit(?:ed)?)\b/i,
    education:/\b(tutorial|guide|how to|documentation|learn|explainer)\b/i,
    governance:/\b(governance|proposal|vote|dao|treasury)\b/i,
    community:/\b(community|ama|spaces|event|meetup|hackathon|webinar)\b/i,
    promotion:/\b(giveaway|airdrop|reward|prize|win|competition|incentive)\b/i,
  };
  const contentMix=Object.fromEntries(Object.entries(contentRules).map(([label,rule])=>[
    label,recent.filter(post=>rule.test(post.text ?? '')).length,
  ]));
  const observations=[];
  if (posts.length) observations.push(ageDays<=7 ? 'The latest captured post is within the last week.'
    : ageDays<=30 ? 'The latest captured post is within the last month.'
    : 'The newest captured post is older than 30 days. This does not establish inactivity on other channels.');
  if (!eligible && posts.length) observations.push('The sample is too small or incomplete for a publishing score.');
  if (recent.length && weeks.size<3) observations.push('Captured activity is concentrated in fewer than three of the last four weeks.');
  if (contentMix.promotion>recent.length/2) observations.push('More than half of recent captured posts mention promotional terms.');
  if (contentMix.product) observations.push('Some posts mention product releases, integrations, or audits. These are communication claims, not verified delivery.');
  const productPosts=posts.filter(post=>/\b(launch(?:ed)?|release[ds]?|upgrade[ds]?|mainnet|integrat(?:ion|ed)|audit(?:ed)?)\b/i.test(post.text ?? ''));
  return {
    ...source,posts,sampleCount:posts.length,recentPosts:recent.length,activeWeeks:weeks.size,
    daysSinceLastPost:ageDays===null ? null : rounded(ageDays),score,contributions,engagement,
    coverage:complete ? 'latest_30' : reachesWindow ? 'covers_30_days' : 'partial',
    summary:source.status!=='collected' ? 'Collection unavailable. No activity score assigned.'
      : !posts.length ? 'No dated public posts were returned. No activity score assigned.'
      : `${recent.length} of ${posts.length} sampled posts fall in the last 30 days, spanning ${weeks.size} of the last four weeks.`,
    contentMix,observations,
    signals:productPosts.slice(0,5).map(post=>({url:post.url,publishedAt:post.publishedAt,
      label:'Mentions a release, integration, or audit',excerpt:post.text.slice(0,240)})),
  };
}

export function analyzeProjectSocial(project, observedAt) {
  const sources = project.sources.map(source=>analyzeSocialSource(source,source.checkedAt ?? observedAt));
  return {
    ...project, observedAt,methodology:socialMethodology.version,
    status:sources.some(source=>source.status==='collected'&&source.sampleCount) ? 'partial' : 'unavailable',
    sources,
    summary:sources.some(source=>source.score!==null)
      ? 'Platform scores are shown separately because collection coverage and audience behavior differ.'
      : 'Evidence is being collected. A comparable publishing score needs a complete dated sample.',
  };
}
