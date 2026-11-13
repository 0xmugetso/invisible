import {BrandMotion} from '../brand-motion';
import type {Metadata} from 'next';
import Link from 'next/link';
import Icon from '../interface-icon';
import GuideProgress from './guide-progress';
import {IntegrationEditor} from '../integration-editor';
import RankingWeights from '../ranking-weights';
import '../landing.css';
import './guide.css';

export const metadata:Metadata={title:'Invisible Guide',description:'Use Invisible to research NEAR projects, verify the evidence behind rankings, and connect your agent.'};

const sections=[
  ['dashboard','Dashboard','dashboard'],['evidence','Deployments','contracts'],['forecast','Forecast','simulation'],['investment-methodology','Methodology','ranking'],
  ['sources','Sources','globe'],['rest','REST API','api'],['mcp','MCP','connect'],['a2a','A2A','ecosystem'],['skill','Agent Skill','research'],
] as const;
const endpoints=[
  ['/api/v1/projects?q=rhea','Search catalog entries by name, ID, or contract. Use page for pagination.'],
  ['/api/v1/projects/rhea','Get contract attribution, signer counts, example transactions, and tokenomics for a verified project.'],
  ['/api/v1/projects/rhea/market','Get separately retrieved market figures for verified tokens.'],
  ['/api/v1/projects/rhea','Read one project and its evidence.'],
  ['/api/v1/projects/rhea/market','Read the available pool, valuation and token market evidence.'],
  ['/api/v1/rankings','Read activity rankings and eligibility.'],
  ['/api/v1/investment','Read rankings that include liquidity and valuation.'],
  ['/api/v1/returning-signers?limit=10','Order eligible projects by the count of returning signers.'],
  ['/api/v1/forecast','Read the next-window scenarios and available historical checks.'],
];

export default function Guide() {
  return <div className="iv-landing iv-guide">
    <header className="iv-guide-header iv-width">
      <Link className="iv-wordmark" href="/"><BrandMotion/> Invisible</Link>
      <Link className="iv-route-button iv-route-primary" href="/app/"><Icon name="arrowBack"/> Back to Dashboard <Icon name="overview"/></Link>
    </header>
    <div className="iv-guide-layout iv-width">
      <aside><GuideProgress sections={sections}/></aside>
      <main id="main-content">
        <h1>Invisible Guide</h1>
        <p>Find NEAR projects with repeat activity, trace a ranking back to its contracts, and give your agent the same data.</p>
        <section id="dashboard"><h2>Dashboard</h2>
          <p>Open the workspace, choose Meteor or another supported NEAR wallet, and sign a message to create your profile. The profile menu shows the NEAR account you used and lets you sign out.</p>
          <p>Use <strong>Investment</strong> for an activity and market comparison, <strong>Activity</strong> for usage across mapped contracts, or <strong>All Verified</strong> to see which projects lack enough evidence to qualify. Select a row to update the charts. The magnifier opens its evidence.</p>
          <img src="/dashboard-walkthrough.webp" width="1440" height="900" alt="Invisible dashboard with the project leaderboard and charts for signer cohorts and scores"/>
        </section>
        <section id="evidence"><h2>Deployment Evidence</h2>
          <p>Open a project's evidence from the dashboard or leaderboard. Score contributions show how the project performed against peers. Tokenomics lists published allocation and vesting terms. Market figures include their own retrieval date and source.</p>
          <img src="/guide/project-evidence.webp" alt="Rhea Finance evidence showing score contributions and published vesting terms" loading="lazy"/>
          <p>In <Link href="/app/deployments/">Deployments</Link>, search by contract address or project. Project pages explain whether an account is a product contract, token, or shared service. Contract pages link to example transactions and show measured cohorts when available. The mainnet block sample refresh is scheduled every six hours. Check the saved block time for freshness. Contract transactions are sampled in rotation to stay within the provider limit.</p>
          <img src="/guide/deployments.webp" alt="Invisible contract explorer showing the mainnet activity chart and deployment directory" loading="lazy"/>
          <p><Link href="/app/ecosystem/">Ecosystem</Link> compares changes in tracked contract volume and signer participation. The network gas series covers indexed mainnet activity when a complete series is available.</p>
        </section>
        <section id="forecast"><h2>Forecast</h2>
          <p>In Leaderboard, choose <strong>Forecast</strong> and select a project. The flat baseline carries forward the latest signer count. The cohort scenario applies the measured return rate to the latest cohort and carries forward the count seen only in that latest window. A third complete window lets us compare both estimates against what actually happened.</p>
          <img src="/guide/forecast.webp" alt="Signer forecast showing observed 28-day windows, a flat baseline, and historical error" loading="lazy"/>
        </section>
        <section id="investment-methodology"><h2>How Invisible Measures Activity</h2>
          <p>We count distinct signing accounts that directly attempted a function call to a mapped NEAR contract. We compare two complete, adjacent 28-day UTC windows. A returning signer appears in both. Calls routed through shared contracts or downstream receipts can fall outside a project's measured activity.</p>
          <p>Projects need a verified token, at least 50 signers in each window, 10 in the prior weekly window, 10 returning signers, and activity on at least 14 days in the latest window. A signer is a NEAR account. Shared relayers, automation, and multiple accounts can affect the counts.</p>
          <dl className="iv-guide-metrics">
            <div><dt>35% Adjusted Return Rate</dt><dd>Returning signers divided by the previous cohort plus 50.</dd></div>
            <div><dt>30% Returning Signers</dt><dd>Accounts observed in both windows.</dd></div>
            <div><dt>25% Adjusted Growth</dt><dd>Net signer change divided by the previous cohort plus 50.</dd></div>
            <div><dt>10% Activity Spread</dt><dd>One minus the busiest day's share of the sum of daily signer counts.</dd></div>
          </dl>
          <p>Activity scores combine relative percentiles across eligible peers. The investment ranking adds market inputs and requires comparable pool and valuation data.</p>
          <RankingWeights/>
          <p><a href="/thesis-observed.md" download>Download the archived pilot report</a>. The archive uses the pilot methodology and its own dated snapshot.</p>
        </section>
        <section id="sources"><h2>Data Sources</h2>
          <ul>
            <li>NEAR's public BigQuery dataset supplies indexed function-call and signer history. <a href="https://github.com/near/near-public-lakehouse">NEAR Public Lakehouse</a></li>
            <li>NearBlocks supplies saved mainnet samples, token data, and transaction evidence. <a href="https://nearblocks.io/">NearBlocks</a></li>
            <li>DEX Screener supplies pool liquidity and valuation inputs. CoinGecko can supply market rank and valuation when the token can be matched. <a href="https://dexscreener.com/near">DEX Screener</a> · <a href="https://www.coingecko.com/">CoinGecko</a></li>
            <li>Project documentation and code supply attribution and published tokenomics. The ecosystem catalog marks unverified leads separately.</li>
          </ul>
        </section>
        <section id="rest"><h2>REST API</h2><p>Send a GET request to the same public data used in the workspace. Read the cutoff and status fields before comparing projects.</p>
          <IntegrationEditor only="REST API"/>
          <p>Endpoints return JSON and support public, read-only access. Use the catalog to resolve a stable project ID before requesting its evidence. Use the market endpoint to check source and observation time separately from the activity cutoff.</p>
          <dl className="iv-guide-endpoints">{endpoints.map(([path,detail])=><div key={path}><dt><a href={path}><code>{path}</code></a></dt><dd>{detail}</dd></div>)}</dl>
        </section>
        <section id="mcp"><h2>MCP</h2>
          <p>Connect a client using Streamable HTTP. Invisible exposes <code>search_projects</code>, <code>get_project_evidence</code>, and <code>get_rankings</code>.</p>
          <IntegrationEditor only="MCP"/>
          <ul><li><code>search_projects</code> resolves a project name, token, or contract to its catalog ID.</li><li><code>get_project_evidence</code> returns mapped contracts, source links, and available project evidence.</li><li><code>get_rankings</code> reads activity, investment, or returning-signer rankings. Check which cohort and cutoff the result uses.</li></ul>
          <p>Ask “Which NEAR projects brought the most signers back? Show me the evidence.”</p>
        </section>
        <section id="a2a"><h2>Agent-to-Agent</h2>
          <p>Fetch the agent card, then send an A2A 0.3 JSON-RPC <code>message/send</code> request. The agent accepts returning-signer comparisons, project searches, and verified project IDs. It returns a direct response with research data.</p>
          <IntegrationEditor only="A2A"/>
          <p>Read the agent card to discover the request endpoint and supported skills. Send a JSON-RPC request with a unique message ID and a text prompt, then read the returned research alongside its source links. <a href="/.well-known/agent-card.json">Read the Agent Card <Icon name="launch"/></a></p>
        </section>
        <section id="skill"><h2>Agent Skill</h2>
          <p>Install the skill in your agent's project skills directory. It explains when to use each tool, how to cite evidence, and how to distinguish forecasts from observed activity.</p>
          <IntegrationEditor only="Skill"/>
          <p>The skill supplies a research workflow. It tells the agent how to find the project, read the ranking inputs, and cite the evidence. The MCP setup above adds the tools to clients that support them. <a href="/skill/SKILL.md" download>Download SKILL.md <Icon name="down"/></a></p>
        </section>
      </main>
    </div>
  </div>;
}
