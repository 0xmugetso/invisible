import {readFileSync} from 'node:fs';
import {summarizeDeployments} from './summarize-deployments';

export function deploymentSummary() {
  return summarizeDeployments(JSON.parse(readFileSync('public/deployments.json', 'utf8')));
}
