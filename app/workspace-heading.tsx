import type {ReactNode} from 'react';

export default function WorkspaceHeading({title,description,actions,id}:{title:string;description?:string;actions?:ReactNode;id?:string}) {
  return <div className="iv-workspace-heading">
    <div><h1 id={id}>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="iv-page-actions">{actions}</div>}
  </div>;
}
