'use client';

import {useEffect,useRef,useState} from 'react';

import Icon from '../interface-icon';
import {demoVideoId} from './demo-video';

export default function DemoPlayer() {
  const [playing,setPlaying]=useState(false);
  const frame=useRef<HTMLIFrameElement>(null);

  useEffect(()=>{
    if (playing) frame.current?.focus();
  },[playing]);

  return <div className="iv-guide-player">
    {playing
      ? <iframe
          ref={frame}
          src={`https://www.youtube-nocookie.com/embed/${demoVideoId}?autoplay=1&playsinline=1`}
          title="Invisible product walkthrough"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      : <button type="button" onClick={()=>setPlaying(true)} aria-label="Play the Invisible product walkthrough">
          <img src="/readme/video-cover.webp" width="1280" height="720" alt=""/>
          <span className="iv-guide-play-label"><Icon name="play"/> Play Demo</span>
        </button>}
  </div>;
}
