import Icon from './interface-icon';

export type SocialEvidenceData = {
  observedAt:string;stale:boolean;status:string;summary:string;rankingEffect:string;
  sources:{
    platform:string;url:string;checkedAt:string;status:string;sampleCount:number;recentPosts:number;activeWeeks:number;
    authoredPosts:number;recentAuthoredPosts:number;repostCount:number;
    engagement:Record<string,{median:number|null;measuredPosts:number}>;
    engagementRate:{medianPercent:number|null;measuredPosts:number};
    contentMix:Record<string,number>;
    score:number|null;coverage:string;error:string|null;summary:string;
    contributions:{recency:number;cadence:number;continuity:number}|null;
    posts:{url:string;publishedAt:string;text:string;kind?:string}[];
    observations:string[];
    signals:{url:string;label:string;excerpt:string;publishedAt:string}[];
  }[];
};

export default function SocialEvidence({data}:{data:SocialEvidenceData}) {
  return <section className="iv-dossier-section iv-social-evidence">
    <div className="iv-dossier-title">
      <h3><Icon name="users"/> Social Activity</h3>
      <small>{data.stale ? 'Older collection' : 'Collected'} {data.observedAt.slice(0,10)} UTC</small>
    </div>
    <p>Publishing activity is measured separately for each channel. These scores are research signals and carry no weight in the investment ranking.</p>
    {!data.sources.length && <p>No official channel history was found through the project’s attributed links.</p>}
    {data.sources.map((source,index)=><article className="iv-social-source" key={source.url+index}>
      <div className="iv-social-source-head">
        <a href={source.url} target="_blank" rel="noreferrer">{source.platform} <Icon name="launch"/></a>
        <strong>{source.score===null ? 'Awaiting Coverage' : source.score.toFixed(1)+' / 100'}</strong>
      </div>
      {source.score!==null && <meter min="0" max="100" value={source.score} aria-label={source.platform+' publishing score'}/>}
      {(source.sampleCount>0 || !source.error) && <p>{source.summary}</p>}
      <small>Source checked {source.checkedAt.slice(0,10)} UTC</small>
      {source.sampleCount>0 && <dl className="iv-social-facts">
        <div><dt>Dated Posts</dt><dd>{source.sampleCount} / 30</dd></div>
        <div><dt>Authored in 30 Days</dt><dd>{source.recentAuthoredPosts} posts</dd></div>
        <div><dt>Active Weeks</dt><dd>{source.activeWeeks} / 4</dd></div>
      </dl>}
      {source.repostCount>0 && <p>{source.repostCount} reposts are visible in the evidence and excluded from the score.</p>}
      {source.engagement && Object.values(source.engagement).some(metric=>metric.measuredPosts>0) && <dl className="iv-social-facts">
        {(['likes','replies','reposts','views'] as const).map(metric=>source.engagement[metric] && source.engagement[metric].median!==null && <div key={metric}>
          <dt>Median {metric[0].toUpperCase()+metric.slice(1)}</dt><dd>{source.engagement[metric].median?.toLocaleString('en-US')}</dd>
        </div>)}
        {source.engagementRate && source.engagementRate.medianPercent!==null && <div><dt>Median Engagement / View</dt><dd>{source.engagementRate.medianPercent}%</dd></div>}
      </dl>}
      {source.contentMix && Object.values(source.contentMix).some(count=>count>0) && <dl className="iv-social-facts">
        {Object.entries(source.contentMix).filter(([,count])=>count>0).map(([label,count])=><div key={label}><dt>{({product:'Release Mentions',education:'Guides & Learning',governance:'Governance Mentions',community:'Community Mentions',promotion:'Promotion Mentions'} as Record<string,string>)[label]}</dt><dd>{count} posts</dd></div>)}
      </dl>}
      {source.contributions && <p className="iv-social-weights">Recency {source.contributions.recency}/40 · Cadence {source.contributions.cadence}/30 · Continuity {source.contributions.continuity}/30</p>}
      {source.observations?.map(note=><p key={note}>{note}</p>)}
      {source.error && <p>{source.error==='NEED_LOGIN' ? 'The collector needs an authenticated session to read this timeline.'
        : source.error==='HISTORY_ADAPTER_PENDING' ? 'Official channel found. History collection is under development.'
        : 'Public history could not be retrieved in this collection.'}</p>}
      {source.posts.length>0 && <details>
        <summary>Inspect Source Posts</summary>
        <ol>{source.posts.slice(0,30).map(post=><li key={post.url}>
          <a href={post.url} target="_blank" rel="noreferrer">{post.kind==='repost' && 'Repost · '}<time dateTime={post.publishedAt}>{post.publishedAt.slice(0,10)}</time> <Icon name="launch"/></a>
          <p>{post.text.slice(0,280)}</p>
        </li>)}</ol>
      </details>}
    </article>)}
    <a href="/docs/#social-activity">How Social Activity Is Measured <Icon name="launch"/></a>
  </section>;
}
