import {CountUp} from './research-graphics';
import {investmentWeights} from '../services/investment-ranking.mjs';

const factors = [
  ['activity','On-Chain Activity','Usage across the project’s attributed contracts.'],
  ['poolLiquidity','Pool Reserves','Largest indexed NEAR pool, compared with ranked peers.'],
  ['circulatingValuationShare','Market Cap / FDV','Reported market cap as a share of fully diluted valuation.'],
] as const;

export default function RankingWeights() {
  return <div className="iv-weights">
    {factors.map(([key,label,description])=><article className="iv-card" key={key} data-reveal>
      <strong><CountUp value={investmentWeights[key]+'%'}/></strong><h3>{label}</h3><p>{description}</p>
    </article>)}
  </div>;
}
