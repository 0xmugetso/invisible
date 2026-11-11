export const activityThresholds = {
  current_signers:50,
  prior_signers:50,
  prior_weekly_signers:10,
  repeat_signers:10,
  active_days:14,
};

export function unmetActivityThresholds(activity) {
  return Object.entries(activityThresholds).flatMap(([metric,minimum]) => {
    const observed = Number(activity[metric]);
    return observed >= minimum ? [] : [{metric,minimum,observed:Number.isFinite(observed) ? observed : null}];
  });
}
