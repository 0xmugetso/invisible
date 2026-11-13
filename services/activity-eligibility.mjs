import catalog from '../data/ecosystem-catalog.json' with {type:'json'};

const memeProjectIds = new Set(catalog.projects.filter(project => project.categories.includes('memecoin'))
  .map(project => project.registryId ?? project.id));
export const isMemeProject = id => memeProjectIds.has(id);

export const warehouseActivityMethodology = 'activity-warehouse-v8';
export const warehouseReadMethodologies = [warehouseActivityMethodology,'activity-warehouse-v7','activity-warehouse-v6','activity-warehouse-v5','activity-warehouse-v4'];

export const activityThresholds = {
  current_signers:50,
  prior_signers:50,
  prior_weekly_signers:10,
  repeat_signers:10,
  active_days:14,
};

export function unmetActivityThresholds(activity) {
  return Object.entries(activityThresholds).flatMap(([metric,minimum]) => {
    const value = activity[metric];
    const observed = value === null || value === undefined || value === '' ? NaN : Number(value);
    return observed >= minimum ? [] : [{metric,minimum,observed:Number.isFinite(observed) ? observed : null}];
  });
}

export function rankActivity(analysis) {
  const eligible = analysis.filter(row => row.tokens.length && !isMemeProject(row.project_id) && !unmetActivityThresholds(row).length).map(({contract_activity,...row}) => ({
    ...row,
    adjusted_return: row.repeat_signers / (row.prior_signers + 50),
    adjusted_growth: (row.current_signers - row.prior_signers) / (row.prior_signers + 50),
    adjusted_weekly_growth: (row.weekly_signers - row.prior_weekly_signers) / (row.prior_weekly_signers + 25),
  }));
  const weights = {adjusted_return: .35, repeat_signers: .30, adjusted_growth: .25, spread: .10};
  const doubledPeerRank = (key, value) => {
    const below = eligible.filter(row => row[key] < value).length;
    const tied = eligible.filter(row => row[key] === value).length;
    return 2 * below + tied;
  };
  const ranked = eligible.length < 3 ? [] : eligible.map(row => {
    const denominator = 2 * eligible.length;
    const ranks = Object.fromEntries(Object.keys(weights).map(key => [key, doubledPeerRank(key,row[key])]));
    const components = Object.fromEntries(Object.entries(ranks).map(([key,rank]) => [key, rank / denominator]));
    const weightedRank = Object.entries(weights).reduce((sum,[key,weight]) => sum + Math.round(weight*100)*ranks[key],0);
    const score = Math.round(weightedRank / denominator);
    return {...row,score,components};
  }).sort((a,b) => b.score-a.score || b.repeat_signers-a.repeat_signers || a.project_id.localeCompare(b.project_id));
  return {weights,ranked};
}
