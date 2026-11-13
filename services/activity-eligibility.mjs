export const warehouseActivityMethodology = 'activity-warehouse-v7';
export const warehouseReadMethodologies = [warehouseActivityMethodology,'activity-warehouse-v6','activity-warehouse-v5','activity-warehouse-v4'];

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
