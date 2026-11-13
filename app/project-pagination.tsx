import Icon from './interface-icon';

export default function ProjectPagination({page,pageSize,total,onPageChange,label='Projects'}:{
  page:number; pageSize:number; total:number; onPageChange:(page:number)=>void; label?:string;
}) {
  if (total<=pageSize) return null;
  return <nav className="iv-pagination" aria-label={label+' pagination'}>
    <span aria-live="polite">{page*pageSize+1}–{Math.min((page+1)*pageSize,total)} of {total.toLocaleString('en-US')}</span>
    <div>
      <button type="button" className="iv-outline" disabled={page===0} onClick={()=>onPageChange(page-1)} aria-label="Previous page"><Icon name="left"/></button>
      <button type="button" className="iv-outline" disabled={(page+1)*pageSize>=total} onClick={()=>onPageChange(page+1)} aria-label="Next page"><Icon name="right"/></button>
    </div>
  </nav>;
}
