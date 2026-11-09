import {dateAt} from '../lib/model.mjs';
import type {Snapshot} from './deployment-atlas';

export function summarizeDeployments(snapshot: Snapshot) {
  const leaders = snapshot.rows
    .map(([contract, , , , earlier, later, again, , , , , , , , methods]) => ({
      contract, gain: later - earlier, earlier, later, again, method: methods[0] ?? null,
    }))
    .filter(row => row.gain > 0)
    .sort((a, b) => b.gain - a.gain || a.contract.localeCompare(b.contract))
    .slice(0, 3);
  return {
    accounts: snapshot.rows.length,
    from: dateAt(snapshot.end, -84),
    through: dateAt(snapshot.end, -1),
    leaders,
  };
}

export type DeploymentSummary = ReturnType<typeof summarizeDeployments>;
