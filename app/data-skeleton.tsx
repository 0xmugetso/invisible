export default function DataSkeleton({label,variant='rows'}:{label:string;variant?:'rows'|'cards'}) {
  return <div className="iv-card iv-data-skeleton" data-skeleton={variant} role="status" aria-busy="true">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">
      {Array.from({length:variant==='cards' ? 3 : 5},(_,index)=><div key={index}>
        <i className="iv-skeleton-line"/><i className="iv-skeleton-line"/><i className="iv-skeleton-line"/>
      </div>)}
    </div>
  </div>;
}
