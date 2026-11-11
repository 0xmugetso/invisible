const marks:Record<string,string> = {
  // Project marks from rhea.finance, nearmobile.app, docs.intear.tech, justhoot.fun,
  // pumpopoly.com, nearly.trade, metapool.app, and linearprotocol.org.
  rhea:'rhea.webp',
  nearmobile:'nearmobile.webp',
  intear:'intear.svg',
  justhoot:'justhoot.webp',
  pumpopoly:'pumpopoly.webp',
  nearly:'nearly.webp',
  metapool:'meta-pool.svg',
  linear:'linear.svg',
  // Issuer-published NEP-148 icons from gear.enleap.near and the HAPI bridge token.
  enleap:'enleap.webp',
  hapi:'hapi.svg',
};

export default function ProjectMark({id}: {id:string}) {
  const mark = marks[id];
  return mark ? <img className="iv-project-mark" src={'/marks/'+mark} width="28" height="28" alt=""/> : null;
}
