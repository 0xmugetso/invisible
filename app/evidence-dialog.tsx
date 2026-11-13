'use client';

import {useId,useLayoutEffect,useRef,type ReactNode} from 'react';
import Icon from './interface-icon';
import ProjectMark from './project-mark';

export default function EvidenceDialog({projectId,title,subtitle,actions,returnFocus,onDismiss,children}:{
  projectId:string; title:string; subtitle:string; actions?:ReactNode; returnFocus?:HTMLElement|null; onDismiss:()=>void; children:ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const heading = useId();
  useLayoutEffect(()=>{
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = returnFocus ?? document.activeElement;
    dialog.showModal();
    close.current?.focus({preventScroll:true});
    return ()=>{
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({preventScroll:true});
    };
  },[returnFocus]);

  return <dialog className="iv-evidence-dialog" ref={ref} aria-labelledby={heading}
    onCancel={event=>{event.preventDefault();onDismiss();}} onClick={event=>{if (event.target===event.currentTarget) onDismiss();}}>
    <div className="iv-dialog-surface">
      <div className="iv-dialog-head">
        <div className="iv-dialog-identity"><ProjectMark id={projectId}/><div><h2 id={heading}>{title}</h2><p>{subtitle}</p></div></div>
        <div className="iv-dialog-actions">{actions}<button className="iv-dialog-close" type="button" ref={close} aria-label="Close evidence" onClick={onDismiss}><Icon name="close"/></button></div>
      </div>
      <div className="iv-dialog-body">{children}</div>
    </div>
  </dialog>;
}
