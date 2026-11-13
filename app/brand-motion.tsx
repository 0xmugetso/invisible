export function BrandMotion() {
  return <span className="iv-brand-motion" aria-hidden="true">
    <svg viewBox="7 0 74 74" fill="none">
      <path className="iv-brand-solid" fill="currentColor" fillRule="evenodd" d="M15 12h58v49H15Zm22 16v17h15v16h8V28Z"/>
    </svg>
  </span>;
}

export function LoadingPanel({title,description}:{title:string;description:string}) {
  return <div className="iv-loading-panel" role="status">
    <BrandMotion/>
    <div><strong>{title}</strong><p>{description}</p></div>
  </div>;
}
