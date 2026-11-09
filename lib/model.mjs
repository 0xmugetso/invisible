export const VERSION = '1.0';
export const minimum = 50;
export const ratio = (n,d) => d > 0 ? n/d : null;
export const growth = (n,d) => d > 0 ? n/d-1 : null;
export const pct = x => x == null ? '—' : `${Math.round(x*100)}%`;
export const change = x => x == null ? '—' : `${x>0?'+':''}${pct(x)}`;
export const dateAt = (end, offset) => new Date(Date.parse(end+'T00:00:00Z') + offset*86400000).toISOString().slice(0,10);
export function percentile(value, values) {
  return 100*(values.filter(n=>n<value).length + .5*values.filter(n=>n===value).length)/values.length;
}
export function rank(projects, snapshot) {
  const rows = projects.map(p=>{
    const m = snapshot?.metrics[p.id] ?? null;
    return {...p,m,g7:m?growth(m.a7,m.b7):null,g28:m?growth(m.a28,m.b28):null,ret:m?ratio(m.repeat,m.b28):null,
      dev:m?.commits?.[0] != null && m.commits[1] != null ? growth(m.commits[0],m.commits[1]) : null,
      att:m?.attention?.[0] != null && m.attention[1] != null ? growth(m.attention[0],m.attention[1]) : null};
  });
  const eligible = rows.filter(r=>!r.benchmark && r.m && r.m.b28>=minimum && r.m.a28>=minimum && r.m.b7>=10);
  // Use a common metric set for all ranked projects so scores remain comparable.
  const dev = eligible.length>=3 && eligible.every(r=>r.dev!=null);
  const attention = eligible.length>=3 && eligible.every(r=>r.att!=null);
  const mode = dev && attention ? 'Invisible Score' : 'Adoption Discovery Score';
  const ranked = rows.map(r=>{
    const ok = eligible.length>=3 && eligible.includes(r);
    const pr = (key) => percentile(r[key],eligible.map(x=>x[key]));
    const components = ok ? {adoption:.25*pr('g7')+.75*pr('g28'),retention:pr('ret'),
      developer:dev?pr('dev'):null,attention:attention?percentile(r.g28-r.att,eligible.map(x=>x.g28-x.att)):null} : null;
    const weight = 70 + (dev?15:0) + (attention?15:0);
    const score = components ? Math.round((40*components.adoption+30*components.retention+15*(components.developer??0)+15*(components.attention??0))/weight) : null;
    const candidate = ok && r.g28>=.25 && r.g7>0 && r.ret>=.25 && r.m.a28-r.m.b28>=25;
    const breakout = candidate && r.att!=null && r.g28-r.att>=.20;
    const signal = breakout?'Attention gap':candidate?'Adoption signal':null;
    const confidence = signal ? (r.m.b28>=250 && r.m.repeat>=100?'Moderate':'Low') : null;
    return {...r,score,components,signal,confidence,weight};
  }).sort((a,b)=>(b.score??-1)-(a.score??-1) || a.name.localeCompare(b.name));
  return {rows:ranked,mode,eligible:eligible.length};
}
export function concentration(values) {
  const total=values.reduce((a,b)=>a+b,0);
  const shares=values.map(x=>ratio(x,total)??0).sort((a,b)=>b-a);
  return {hhi:total?shares.reduce((a,b)=>a+b*b,0):null,top3:total?shares.slice(0,3).reduce((a,b)=>a+b,0):null,total};
}
