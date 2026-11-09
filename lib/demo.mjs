import {dateAt} from './model.mjs';
export function demo(projects) {
  const end='2026-11-01';
  // Synthetic reference scenario; numbers are intentionally unrelated to the named projects.
  const scenarios=[[1260,700,404,231,310],[1460,1010,420,313,370],[840,560,210,160,180],[4320,3950,1120,1050,1470],[1900,2180,490,530,640],[3300,2900,810,750,1330],[520,465,160,143,190],[8300,7310,2200,2020,3500],[130,125,28,30,34],[910,985,215,220,245]];
  const metrics=Object.fromEntries(projects.map((p,i)=>{
    const [a28,b28,a7,b7,repeat]=scenarios[i];
    const daily=Array.from({length:56},(_,j)=>{
      const base=(j<28?b28:a28)/5;
      const accounts=Math.round(base*(.66+.011*(j%28)+.16*Math.sin(j*1.7+i)+.09*Math.cos(j*.64)));
      return {day:dateAt(end,j-56),accounts,tx:Math.round(accounts*(1.6+i*.17))};
    });
    const contracts=p.contracts.map(contract=>({contract,tx:daily.slice(28).reduce((s,x)=>s+x.tx,0),prevTx:daily.slice(0,28).reduce((s,x)=>s+x.tx,0)}));
    return [p.id,{a28,b28,a7,b7,repeat,daily,contracts,tx:contracts[0].tx,prevTx:contracts[0].prevTx,commits:p.repo?[18+i*2,14+i*2]:null,attention:null}];
  }));
  return {kind:'demo',end,created:null,metrics,network:null,provenance:'Synthetic reference scenario v1'};
}
