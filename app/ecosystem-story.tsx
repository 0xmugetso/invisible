import Link from 'next/link';
import {change, concentration, dateAt, pct} from '../lib/model.mjs';
import type {Row, Snapshot} from '../lib/model.mjs';
import {ContributionChart, ResearchChart} from './research-graphics';

const fmt = (value: number) => value.toLocaleString('en-US');

export default function EcosystemStory({rows, snapshot, params, observed}: {
  rows: Row[];
  snapshot: Snapshot;
  params: string;
  observed: boolean;
}) {
  const measured = rows.flatMap(row => row.m ? [{row, metric: row.m, delta: row.m.tx - row.m.prevTx}] : []);
  const contracts = measured.flatMap(({metric}) => metric.contracts);
  const current = concentration(contracts.map(contract => contract.tx));
  const previous = concentration(contracts.map(contract => contract.prevTx));
  const shift = current.top3 != null && previous.top3 != null ? (current.top3 - previous.top3) * 100 : null;
  const largestDrop = measured.filter(item => item.delta < 0).sort((a,b) => a.delta - b.delta)[0];
  const grossLoss = measured.reduce((sum, item) => sum + Math.max(0, -item.delta), 0);
  const divergence = measured
    .filter(({delta, metric}) => (delta > 0 && metric.a28 < metric.b28) || (delta < 0 && metric.a28 > metric.b28))
    .sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  const fees = snapshot.network?.filter(day => day.fees != null) ?? [];

  return <div className="ecosystem-story">
    <section className="story-lead">
      <div>
        <h1>Where activity went</h1>
        <p>Transactions with direct calls to the tracked contracts, {dateAt(snapshot.end,-56)} through {dateAt(snapshot.end,-1)} UTC.</p>
        {!observed && <p className="story-mode">Simulation data</p>}
      </div>
      <figure className="share-figure">
        <figcaption>Share of transactions in the three busiest contracts</figcaption>
        {([['Previous 28 days',previous.top3],['Latest 28 days',current.top3]] as const).map(([label,value])=>
          <div className="research-bar" key={label}>
            <span>{label}</span><strong>{pct(value)}</strong>
            <div aria-hidden="true"><i style={{width: (value ?? 0) * 100 + '%'}}/></div>
          </div>)}
        {shift != null && <p>{Math.abs(shift) < .05 ? 'The share held steady across the two windows.' :
          `The share ${shift > 0 ? 'rose' : 'fell'} ${Math.abs(shift).toFixed(1)} percentage points. Activity ${shift > 0 ? 'became more concentrated' : 'spread across more of the tracked contracts'} by this measure.`}</p>}
      </figure>
    </section>
    <section className="story-evidence">
      <div>
        <h2>{current.total < previous.total ? 'What pulled volume down?' : 'What moved volume?'}</h2>
        <p>Tracked transactions went from {fmt(previous.total)} to {fmt(current.total)} across the two windows.</p>
        {largestDrop && <p><Link href={'/project/'+largestDrop.row.id+'/'+params}>{largestDrop.row.name}</Link> accounted for {pct(-largestDrop.delta / grossLoss)} of all losses among tracked projects that declined, shedding {fmt(-largestDrop.delta)} transactions.</p>}
      </div>
      <ContributionChart rows={measured.filter(item => item.delta !== 0).sort((a,b) => Math.abs(b.delta)-Math.abs(a.delta)).map(({row,delta}) => ({name:row.name,delta}))}/>
    </section>
    {divergence && <section className="story-evidence story-divergence">
      <div>
        <h2>{divergence.delta > 0 ? 'More transactions, fewer signers' : 'Fewer transactions, more signers'}</h2>
        <p>{divergence.row.name} recorded {fmt(divergence.metric.tx)} transactions from {fmt(divergence.metric.a28)} signer accounts in the latest window. In the previous window, {fmt(divergence.metric.b28)} signers made {fmt(divergence.metric.prevTx)} transactions.</p>
        <p>Volume and participation moved in opposite directions. {fmt(divergence.metric.repeat)} signer accounts appeared in both windows.</p>
        <Link href={'/project/'+divergence.row.id+'/'+params}>Inspect {divergence.row.name} ↗</Link>
      </div>
      <dl className="story-pair">
        <div><dt>Transaction volume</dt><dd>{change(divergence.metric.prevTx ? divergence.delta/divergence.metric.prevTx : null)}</dd></div>
        <div><dt>Active signers</dt><dd>{change(divergence.row.g28)}</dd></div>
      </dl>
    </section>}
    {fees.length > 0 && fees.length === snapshot.network?.length && <details className="story-footnote">
      <summary>Network gas charges</summary>
      <p>These daily totals cover indexed network activity. The findings above use the smaller set of tracked contracts.</p>
      <ResearchChart values={fees.map(day => day.fees!)} days={fees.map(day => day.day)} label="Daily NEAR gas charges"/>
    </details>}
    <p className="story-source">Totals count distinct transactions per contract, including failed call attempts. Signers are accounts. <Link href={'/thesis/'+params}>Methods and evidence ↗</Link></p>
  </div>;
}
