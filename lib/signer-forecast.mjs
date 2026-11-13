// Carry the latest measured return rate and the count of signers absent from the previous window forward once.
function carryForward(previous, latest, overlap) {
  if (![previous,latest,overlap].every(value=>Number.isSafeInteger(value) && value>=0) ||
      previous===0 || latest===0 || overlap>Math.min(previous,latest)) return null;
  const returning = Math.round(latest * (overlap / previous));
  const other = latest - overlap;
  return {total:returning+other,returning,other};
}

export function signerForecast(activity, hasEarlierWindow) {
  const {prior_signers:previous,current_signers:latest,repeat_signers:overlap,
    early_signers:early,early_repeat_signers:earlyOverlap}=activity;
  const forecast = carryForward(previous,latest,overlap);
  if (!forecast) return null;
  const tested = hasEarlierWindow ? carryForward(early,previous,earlyOverlap) : null;
  return {
    previous, latest, overlap, forecast,
    backtest:tested ? {forecast:tested.total, baseline:previous, actual:latest} : null,
  };
}
