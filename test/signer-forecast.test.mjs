import assert from 'node:assert/strict';
import test from 'node:test';
import {signerForecast} from '../lib/signer-forecast.mjs';

test('signer forecasts use only earlier cohorts for their historical check', () => {
  const activity = {
    early_signers: 80, prior_signers: 100, current_signers: 120,
    early_repeat_signers: 40, repeat_signers: 50,
  };
  const result = signerForecast(activity, true);
  assert.deepEqual(result.forecast, {total:130, returning:60, other:70});
  assert.deepEqual(result.backtest, {forecast:110, baseline:100, actual:120});
  assert.equal(signerForecast(activity, false).backtest, null);
});

test('signer forecasts reject impossible overlap and missing denominators', () => {
  assert.equal(signerForecast({prior_signers:20,current_signers:10,repeat_signers:11}, false), null);
  assert.equal(signerForecast({prior_signers:0,current_signers:10,repeat_signers:0}, false), null);
  const result = signerForecast({prior_signers:10,current_signers:10,repeat_signers:0}, true);
  assert.deepEqual(result.forecast, {total:10, returning:0, other:10});
  assert.equal(result.backtest, null);
});
