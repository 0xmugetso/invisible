'use client';

import {useEffect, useId, useRef, useState, type ReactNode} from 'react';

export default function MobileNavigation({children}: {children:ReactNode}) {
  const [open,setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(()=>{
    if (!open) return;
    function dismissOutside(event:PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown',dismissOutside);
    return ()=>document.removeEventListener('pointerdown',dismissOutside);
  },[open]);
  return <div ref={root} className="iv-mobile-navigation" data-open={open} onKeyDown={event=>{
    if (event.key==='Escape' && open) {
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
    }
  }}>
    <button className="iv-menu-toggle" type="button" ref={button} aria-expanded={open} aria-controls={id}
      aria-label={open ? 'Close menu' : 'Open menu'} onClick={()=>setOpen(!open)}>
      <span aria-hidden="true"><i/><i/></span>
    </button>
    <div className="iv-mobile-panel" id={id} onClick={event=>{
      if (event.target instanceof Element && event.target.closest('a')) {
        if (open) button.current?.focus({preventScroll:true});
        setOpen(false);
      }
    }}>{children}</div>
  </div>;
}
