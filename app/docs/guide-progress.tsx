'use client';

import {useEffect,useState} from 'react';
import Icon,{type IconName} from '../interface-icon';

export default function GuideProgress({sections}:{sections:readonly (readonly [string,string,IconName])[]}) {
  const [active,setActive]=useState(0);
  useEffect(()=>{
    let frame=0;
    function update() {
      frame=0;
      const readingLine=Math.min(180,window.innerHeight*.28);
      let current=0;
      sections.forEach(([id],index)=>{
        const section=document.getElementById(id);
        if (section && section.getBoundingClientRect().top<=readingLine) current=index;
      });
      if (window.scrollY>0 && Math.ceil(window.scrollY+window.innerHeight)>=document.documentElement.scrollHeight-2) current=sections.length-1;
      setActive(current);
    }
    function schedule() {
      if (!frame) frame=requestAnimationFrame(update);
    }
    const resize=new ResizeObserver(schedule);
    resize.observe(document.getElementById('main-content')!);
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    update();
    return ()=>{
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',schedule);
    };
  },[sections]);
  return <nav aria-label="Guide contents" className="iv-guide-progress">
    <ol>
      {sections.map(([id,label,icon],index)=><li key={id} data-passed={index<active}>
        <a href={'#'+id} aria-current={index===active ? 'location' : undefined}>
          <span className="iv-guide-dot" aria-hidden="true"/>
          <Icon name={icon}/>{label}
        </a>
      </li>)}
    </ol>
  </nav>;
}
