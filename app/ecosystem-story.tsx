import WorkspaceHeading from './workspace-heading';
import Link from 'next/link';
import {change, concentration, dateAt, pct} from '../lib/model.mjs';
import type {Row, Snapshot} from '../lib/model.mjs';
import Icon from './interface-icon';
import {ContributionChart, ResearchChart} from './research-graphics';

const fmt = (value: number) => value.toLocaleString('en-US');

export default function EcosystemStory({rows, snapshot, params, modeControl}: {
  rows: Row[];
  snapshot: Snapshot;
  params: string;
  modeControl: React.ReactNode;
}) {
  const measured = rows.flatMap(row => row.m ? [{row, metric: row.m, delta: row.m.tx - row.m.prevTx}] : []);
  const contracts = measured.flatMap(({metric}) => metric.contracts);
  const current = concentration(contracts.map(contract => contract.tx));
  const previous = concentration(contracts.map(contract => contract.prevTx));
  const shift = current.top3 != null && previous.top3 != null ? (current.top3 - previous.top3) * 100 : null;
  const largestGain = measured.filter(item=>item.delta>0).sort((a,b)=>b.delta-a.delta)[0];
  const grossGain = measured.reduce((sum,item)=>sum+Math.max(0,item.delta),0);
  const largestDrop = measured.filter(item => item.delta < 0).sort((a,b) => a.delta - b.delta)[0];
  const grossLoss = measured.reduce((sum, item) => sum + Math.max(0, -item.delta), 0);
  const divergence = measured
    .filter(({delta, metric}) => (delta > 0 && metric.a28 < metric.b28) || (delta < 0 && metric.a28 > metric.b28))
    .sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  const volumeChange = previous.total ? current.total/previous.total-1 : null;
  const fees = snapshot.network?.filter(day => day.fees != null) ?? [];

  return <div className="ecosystem-story">
    <WorkspaceHeading title="NEAR Ecosystem Activity"
      description="See where transactions grew or fell across tracked contracts, and whether more signer accounts took part."
      actions={<>{modeControl}<div className="iv-snapshot"><Icon name="observed"/>Through {dateAt(snapshot.end,-1)} UTC</div></>}/>
    <div className="iv-metrics">
      <div className="iv-card iv-metric"><span>Latest 28-Day Transactions</span><strong>{fmt(current.total)}</strong><p>{fmt(previous.total)} in the previous window</p></div>
      <div className="iv-card iv-metric"><span>Volume Change</span><strong>{change(volumeChange)}</strong><p>Across the tracked contracts</p></div>
      <div className="iv-card iv-metric"><span>Share in Top Three Contracts</span><strong>{pct(current.top3)}</strong><p>{pct(previous.top3)} in the previous window</p></div>
    </div>
    <section className="iv-card iv-study-card iv-network-gas">
      <h2>Network Gas Charges</h2>
      {fees.length>0 && fees.length===snapshot.network?.length ? <>
        <p>Daily gas charges across indexed NEAR mainnet activity.</p>
        <ResearchChart values={fees.map(day=>day.fees!)} days={fees.map(day=>day.day)} label="Daily NEAR gas charges"/>
      </> : <p>Daily network gas totals are unavailable for this snapshot.</p>}
    </section>
    <div className="iv-ecosystem-grid iv-ready-fade">
      <section className="iv-card iv-study-card">
        <h2>Which Projects Moved Volume?</h2>
        <p>Change in tracked transactions across the two 28-day windows.</p>
        {largestDrop && <p><Link className="iv-text-link" href={'/app/project/'+largestDrop.row.id+'/'+params}>{largestDrop.row.name}</Link> accounted for {pct(-largestDrop.delta/grossLoss)} of the decline among projects with falling volume.</p>}
        {measured.some(item=>item.delta!==0) ? <ContributionChart rows={measured.filter(item=>item.delta!==0).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).map(({row,delta})=>({name:row.name,delta}))}/> : <p>No volume change in this snapshot.</p>}
      </section>
      <div className="iv-ecosystem-side">
      <figure className="iv-card iv-study-card iv-concentration">
        <figcaption>How Concentrated Was Usage?</figcaption>
        <p>Share of transactions in the three busiest tracked contracts.</p>
        {([['Previous 28 days',previous.top3],['Latest 28 days',current.top3]] as const).map(([label,value])=><div className="research-bar" key={label}>
          <span>{label}</span><strong>{pct(value)}</strong><div aria-hidden="true"><i style={{width:(value??0)*100+'%'}}/></div>
        </div>)}
        {shift!=null && <p>{Math.abs(shift)<.05 ? 'The share held steady.' : `The share ${shift>0 ? 'rose' : 'fell'} ${Math.abs(shift).toFixed(1)} percentage points.`}</p>}
      </figure>
      {largestGain && <section className="iv-card iv-study-card iv-ecosystem-mover">
        <h2>Largest Increase</h2>
        <div className="iv-chart-total"><strong>+{fmt(largestGain.delta)}</strong><span>transactions</span></div>
        <p><Link className="iv-text-link" href={'/app/project/'+largestGain.row.id+'/'+params}>{largestGain.row.name} <Icon name="launch"/></Link> accounted for {pct(largestGain.delta/grossGain)} of gains among tracked projects with rising volume.</p>
        <dl className="iv-mover-cohorts">
          <div><dt>Previous 28 Days</dt><dd>{fmt(largestGain.metric.prevTx)}</dd></div>
          <div><dt>Latest 28 Days</dt><dd>{fmt(largestGain.metric.tx)}</dd></div>
        </dl>
      </section>}
      </div>
    </div>
    {divergence && <section className="iv-card iv-study-card story-divergence">
      <div>
        <h2>{divergence.delta > 0 ? 'More transactions, fewer signers' : 'Fewer transactions, more signers'}</h2>
        <p>{divergence.row.name} recorded {fmt(divergence.metric.tx)} transactions from {fmt(divergence.metric.a28)} signer accounts in the latest window. In the previous window, {fmt(divergence.metric.b28)} signers made {fmt(divergence.metric.prevTx)} transactions.</p>
        <p>Volume and participation moved in opposite directions. {fmt(divergence.metric.repeat)} signer accounts appeared in both windows.</p>
        <Link href={'/app/project/'+divergence.row.id+'/'+params}>Inspect {divergence.row.name} ↗</Link>
      </div>
      <dl className="story-pair">
        <div><dt>Transaction volume</dt><dd>{change(divergence.metric.prevTx ? divergence.delta/divergence.metric.prevTx : null)}</dd></div>
        <div><dt>Active signers</dt><dd>{change(divergence.row.g28)}</dd></div>
      </dl>
    </section>}
    <p className="story-source">Totals count distinct transactions per contract, including failed call attempts. Signers are accounts. <Link href={'/docs/'+params}>Methods and evidence ↗</Link></p>
  </div>;
}
