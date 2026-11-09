import Terminal from "../terminal";
import {deploymentSummary} from "../deployment-summary";

export default function Page() {
  return <Terminal view="thesis" coverage={deploymentSummary()}/>;
}
