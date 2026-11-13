'use client';

import {BrandMotion} from './brand-motion';
import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/dist/ScrollTrigger';
import {networkTraces} from './network-background';
import RankingWeights from './ranking-weights';
import MobileNavigation from './mobile-navigation';
import Icon from './interface-icon';
import {IntegrationEditor,Tabs,usePanelReveal} from './integration-editor';

function IntegrationSetup() {
  return <section className="iv-section iv-split iv-connect iv-width" id="connect" data-reveal-section aria-labelledby="iv-connect-title">
    <div className="iv-section-copy">
      <h2 data-flow id="iv-connect-title"><Words text="Connect your agent in two steps"/></h2>
      <p data-flow><Words text="Pick a protocol and an environment to see the setup."/></p>
      <SectionContour pattern="connect"/>
    </div>
    <IntegrationEditor/>
  </section>;
}

function Words({text}:{text:string}) {
  return <>{text.split(/(\s+)/).map((word,index)=>word.trim() ? <span className="iv-reveal-word" key={index}>{word}</span> : word)}</>;
}

const sources = [
  {name:'BigQuery', mark:'/marks/sources/bigquery.svg', title:'Historical contract activity', description:'Build comparable 28-day signer cohorts from indexed NEAR mainnet function calls.', detail:'Check the UTC window and mapped contracts.', url:'https://github.com/near/near-public-lakehouse', link:'NEAR Public Lakehouse'},
  {name:'NearBlocks', mark:'/marks/sources/nearblocks.webp', title:'Recent calls and transaction evidence', description:'Refresh activity from indexed blocks and inspect transactions behind a project’s reported usage.', detail:'Check the signer, receiver, method, and transaction outcome.', url:'https://nearblocks.io/', link:'NearBlocks explorer'},
  {name:'DEX Screener', mark:'/marks/sources/dex-screener.webp', title:'Pool and valuation evidence', description:'Use the largest indexed NEAR pool for each eligible token to compare reserves and reported valuation.', detail:'Check the pair address and observation date in the leaderboard.', url:'https://dexscreener.com/near', link:'NEAR markets'},
];

function Sources() {
  const [selected,setSelected] = useState(0);
  const source = sources[selected];
  const panel = useRef<HTMLElement>(null);
  usePanelReveal(panel, selected);
  return <section id="sources" className="iv-section iv-split iv-sources iv-width" data-reveal-section aria-labelledby="iv-sources-title">
    <div className="iv-section-copy" data-reveal><h2 data-flow id="iv-sources-title"><Words text="Trace the evidence"/></h2><p data-flow><Words text="See what each source contributes and where to check it yourself."/></p></div>
    <div>
      <div data-flow><Tabs id="iv-source" label="Evidence source" items={sources.map(item=>item.name)} marks={sources.map(item=>item.mark)} active={selected} onChange={setSelected}/></div>
      <article data-flow className="iv-card iv-source" ref={panel} id="iv-source-panel" role="tabpanel" aria-labelledby={`iv-source-${selected}`}>
        <h3>{source.title}</h3><p>{source.description}</p><p>{source.detail}</p>
        <a className="iv-text-link" href={source.url}>{source.link} <span aria-hidden="true">↗</span></a>
      </article>
    </div>
  </section>;
}

function Contours() {
  return <div className="iv-contours" aria-hidden="true" data-iv-traces>
    {['left','right'].map((side,sideIndex)=><svg className={`iv-contours-${side}`} key={side} viewBox="0 0 560 1080" preserveAspectRatio="none">
      <g transform="translate(560 0) rotate(90)" fill="none" stroke="currentColor">
        {networkTraces.map((trace,index)=><path key={index} d={trace} opacity={index%5===0 ? .28 : .13} vectorEffect="non-scaling-stroke"/>)}
        {[5,12,20].map((index)=><path key={index} data-iv-trace d={networkTraces[index]} pathLength="100" strokeDasharray="7 93"
          strokeDashoffset={14+index*4+sideIndex*13} vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity=".7"/>)}
      </g>
    </svg>)}
  </div>;
}

const sectionContours = {
  connect: {
    count:17,
    paths:(line:number)=>[
      `M -30 ${47+line*7.5} C 137 ${48+line*9} 225 ${198+line*6} 386 ${175+line*7.4} C 563 ${151+line*9} 535 ${36+line*4} 714 ${54+line*5} C 877 ${70+line*3} 918 ${172+line*5.2} 1202 ${126+line*3}`,
    ],
  },
  insights: {
    count:13,
    paths:(line:number)=>[
      `M 1214 ${112+line*14} C 1020 ${118+line*13} 1008 ${47+line*7} 861 ${57+line*5} C 709 ${65+line*7} 722 ${194+line*6} 544 ${162+line*8.5} C 425 ${140+line*7} 379 ${57+line*5} 265 ${70+line*3} S 137 ${125+line*2} 0 ${116+line}`,
    ],
  },
  ranking: {
    count:15,
    paths:(line:number)=>[
      `M 600 ${113+line*3} C 501 ${96+line*3.7} 451 ${46+line*5} 366 ${76+line*7} C 252 ${118+line*9} 154 ${162+line*7} 0 ${131+line*5}`,
      `M 600 ${113+line*3} C 699 ${130+line*2.3} 764 ${178+line*7} 866 ${151+line*8} C 971 ${122+line*8} 1061 ${67+line*6} 1200 ${92+line*5}`,
    ],
  },
};

function SectionContour({pattern}:{pattern:keyof typeof sectionContours}) {
  const {count,paths} = sectionContours[pattern];
  const center = Math.floor(count/2);
  const delicate = pattern==='ranking';
  return <svg className={`iv-section-contour iv-section-contour-${pattern}`} viewBox="0 0 1200 240"
    preserveAspectRatio="none" fill="none" stroke="currentColor" aria-hidden="true" data-iv-draw={pattern}>
    {Array.from({length:count},(_,index)=>paths(index-center).map((d,part)=>
      <path key={`${index}-${part}`} d={d} pathLength="1" vectorEffect="non-scaling-stroke"
        opacity={delicate ? (index===center ? .66 : .40) : index===center ? .82 : .32}
        strokeWidth={delicate ? .65 : index===center ? 1.55 : .9}/>))}
  </svg>;
}

const developerLinks = [
  {label:'GitHub',href:'https://github.com/0xmugetso',icon:'github'},
  {label:'X',href:'https://x.com/missthedip',icon:'x'},
  {label:'Email',href:'mailto:0xmugetso@gmail.com',icon:'gmail'},
];

const milestones = [
  {title:'Verify NEAR Activity',icon:'contracts',done:true,details:'Map projects to contracts, compare returning signers, and link each finding to source transactions.'},
  {title:'Publish the Research Workspace',icon:'overview',done:true,details:'Explore activity and investment rankings, inspect vesting evidence, and compare signer forecasts against observed cohorts.'},
  {title:'Track Social and Product Activity',icon:'observed',done:false,details:'Measure activity from official channels and releases alongside on-chain usage, with separate source and coverage labels.'},
  {title:'Follow Projects and Unlocks',icon:'clock',done:false,details:'Save a watchlist and surface changes in retention, upcoming unlocks, and new contract deployments.'},
  {title:'Explore an Invisible Token',icon:'growth',done:false,details:'Publish proposed utility, distribution, and launch criteria before announcing any dates or terms.'},
] as const;

// Each bend returns to the center of the next milestone column.
const roadmapRoute = 'M 0 120 C 54 120 70 76 120 76 S 188 26 240 26 S 308 76 360 76 S 428 125 480 125 S 548 76 600 76 S 668 25 720 25 S 788 76 840 76 S 908 116 960 116 S 1028 76 1080 76 S 1160 43 1200 43';

function Roadmap() {
  return <section id="roadmap" className="iv-section iv-width iv-roadmap" data-reveal-section aria-labelledby="roadmap-title">
    <div className="iv-roadmap-heading" data-reveal><h2 data-flow id="roadmap-title"><Words text="Roadmap"/></h2><p data-flow><Words text="What’s live today and what we plan to build next."/></p></div>
    <div className="iv-roadmap-body">
      <svg className="iv-roadmap-contour" viewBox="0 0 1200 152" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="iv-roadmap-route-color" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1200" y2="0">
            <stop stopColor="var(--iv-pink)" stopOpacity="0"/>
            <stop offset=".1" stopColor="var(--iv-pink)"/>
            <stop offset=".3" stopColor="var(--iv-pink)"/>
            <stop offset=".43" stopColor="#755263"/>
            <stop offset=".89" stopColor="#755263"/>
            <stop offset="1" stopColor="#755263" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[-3,-2,-1,1,2,3].map((lane)=>
          <path key={lane} d={roadmapRoute} pathLength="1" vectorEffect="non-scaling-stroke" data-roadmap-thread
            transform={`translate(0 ${lane*6})`} stroke="url(#iv-roadmap-route-color)" opacity={.27-Math.abs(lane)*.045}/>)}
        <path d={roadmapRoute} pathLength="1" vectorEffect="non-scaling-stroke" stroke="url(#iv-roadmap-route-color)" data-roadmap-thread/>
        <path d={roadmapRoute} pathLength="1" vectorEffect="non-scaling-stroke" className="iv-roadmap-signal" data-roadmap-signal/>
      </svg>
      <ol className="iv-roadmap-steps">
        {milestones.map(({title,icon,done,details},index)=><li key={title} data-done={done}>
          {index<milestones.length-1 && <svg className="iv-roadmap-contour-mobile" viewBox="0 0 48 140" preserveAspectRatio="none" fill="none" aria-hidden="true">
            {[-1,1,0].map(lane=><path key={lane} d={index%2 ? 'M 24 0 C 24 38 10 39 10 70 S 24 100 24 140' : 'M 24 0 C 24 38 38 39 38 70 S 24 100 24 140'}
              transform={`translate(${lane*4} 0)`} opacity={lane===0 ? 1 : .32} pathLength="1" vectorEffect="non-scaling-stroke" data-roadmap-thread/>)}
          </svg>}
          <div className="iv-roadmap-marker"><Icon name={icon}/></div>
          <div className="iv-roadmap-copy"><h3 data-flow><Words text={title}/></h3><span className="iv-roadmap-status" data-flow>{done ? 'Complete' : 'Coming Soon'}</span><p data-flow><Words text={details}/></p></div>
        </li>)}
      </ol>
    </div>
  </section>;
}

function DashboardPreview() {
  const video=useRef<HTMLVideoElement>(null);
  useEffect(()=>{
    const player=video.current;
    if (!player) return;
    gsap.registerPlugin(ScrollTrigger);
    const size=matchMedia('(max-width:530px)');
    function setPoster() {
      player!.poster=size.matches ? '/dashboard-walkthrough-mobile.webp' : '/dashboard-walkthrough.webp';
    }
    setPoster();
    size.addEventListener('change',setPoster);
    const motion=gsap.matchMedia();
    for (const mobile of [true,false]) {
      const viewport=mobile ? '(max-width:530px)' : '(width > 530px)';
      motion.add(`(prefers-reduced-motion: no-preference) and ${viewport}`,()=>{
        const figure=player.closest('figure');
        if (!figure) return;
        const position={progress:0};
        let requested=false;
        function seek() {
          if (player!.readyState<1 || !Number.isFinite(player!.duration)) return;
          const time=Math.min(player!.duration,1.05+position.progress*(player!.duration-1.05));
          if (Math.abs(player!.currentTime-time)>.016) player!.currentTime=time;
        }
        const trigger=gsap.to(position,{
          progress:1,ease:'none',onUpdate:seek,
          scrollTrigger:{trigger:figure,start:'clamp(top 76%)',end:'clamp(top 18%)',scrub:.35},
        });
        const observer=new IntersectionObserver(([entry])=>{
          if (!entry.isIntersecting || requested) return;
          requested=true;
          player.src=mobile ? '/dashboard-walkthrough-mobile.mp4' : '/dashboard-walkthrough.mp4';
          player.preload='auto';
          observer.disconnect();
        },{rootMargin:'0px 0px 180px 0px'});
        observer.observe(figure);
        player.addEventListener('loadedmetadata',seek);
        return ()=>{
          observer.disconnect();
          trigger.kill();
          player.removeEventListener('loadedmetadata',seek);
          player.removeAttribute('src');
          player.load();
        };
      });
    }
    return ()=>{motion.revert();size.removeEventListener('change',setPoster);};
  },[]);
  return <figure className="iv-preview iv-width" id="preview" data-flow>
    <video ref={video} muted playsInline preload="none" poster="/dashboard-walkthrough.webp"
      aria-label="Dashboard reveal showing project metrics, the leaderboard, and signer charts" width="1440" height="926"/>
  </figure>;
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    if (['demo','observed','forecast'].includes(params.get('data') ?? '')) {
      window.location.replace('/app/discovery/'+window.location.search+window.location.hash);
      return;
    }
    const node = root.current;
    if (!node) return;
    gsap.registerPlugin(ScrollTrigger);
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)',context=>{
      const flow=Array.from(node.querySelectorAll<HTMLElement>('[data-flow], [data-reveal]'))
        .filter(element=>!element.matches('.iv-section-copy,.iv-method-head,.iv-roadmap-heading,.iv-header,.iv-hero *'));
      const intro=gsap.timeline({defaults:{ease:'power3.out'}});
      intro.fromTo(node.querySelector('.iv-header'),{y:-22,opacity:0},{y:0,opacity:1,duration:.8,clearProps:'all'},0);
      intro.fromTo(node.querySelectorAll('.iv-hero h1 .iv-reveal-word'),{y:17,clipPath:'inset(0 0 100% 0)'},{
        y:0,clipPath:'inset(0 -5% -25% -5%)',duration:.86,stagger:.105,clearProps:'transform,clipPath',
      },.34);
      intro.fromTo(node.querySelectorAll('.iv-hero p .iv-reveal-word'),{y:9,clipPath:'inset(0 0 100% 0)'},{
        y:0,clipPath:'inset(0 -8% -28% -8%)',duration:.68,stagger:.044,clearProps:'transform,clipPath',
      },.94);
      intro.fromTo(node.querySelectorAll('.iv-hero-actions a'),{y:12,opacity:0},{y:0,opacity:1,duration:.67,stagger:.13,clearProps:'all'},1.64);
      const queued=new Set<HTMLElement>();
      let frame=0;
      function flush() {
        frame=0;
        const batch=[...queued].sort((a,b)=>flow.indexOf(a)-flow.indexOf(b));
        queued.clear();
        context.add(()=>{
          let delay=0;
          for (const element of batch) {
            const words=element.querySelectorAll('.iv-reveal-word');
            const targets=words.length ? words : element;
            gsap.to(targets,{
              opacity:1,y:0,...(words.length ? {clipPath:'inset(0 -8% -28% -8%)'} : {}),duration:words.length ? .92 : .9,
              stagger:words.length ? {amount:Math.min(.58,words.length*.072)} : 0,
              delay,ease:'power2.out',clearProps:'opacity,transform,clipPath',
            });
            delay=Math.min(delay+(words.length ? .22 : .13),.72);
          }
        });
      }
      const revealObserver=new IntersectionObserver(entries=>{
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element=entry.target as HTMLElement;
          queued.add(element);
          revealObserver.unobserve(element);
        }
        if (queued.size && !frame) frame=requestAnimationFrame(flush);
      },{rootMargin:'0px 0px -12px 0px'});
      function revealFocus(event:FocusEvent) {
        const element=(event.target as HTMLElement).closest<HTMLElement>('[data-flow], [data-reveal]');
        if (!element || !flow.includes(element)) return;
        revealObserver.unobserve(element);
        queued.delete(element);
        const words=element.querySelectorAll('.iv-reveal-word');
        const targets=words.length ? words : element;
        gsap.killTweensOf(targets);
        gsap.set(targets,{clearProps:'opacity,transform,clipPath'});
      }
      node.addEventListener('focusin',revealFocus);
      flow.forEach(element=>{
        const words=element.querySelectorAll('.iv-reveal-word');
        gsap.set(words.length ? words : element,words.length ? {clipPath:'inset(0 0 100% 0)',y:9} : {opacity:.22,y:9});
        revealObserver.observe(element);
      });
      const pulses = new Map(Array.from(node.querySelectorAll('[data-iv-traces]'),area=>[
        area,
        gsap.to(area.querySelectorAll('[data-iv-trace]'),{
          attr:{'stroke-dashoffset':(_index:number,path:SVGPathElement)=>Number(path.getAttribute('stroke-dashoffset'))-100},
          duration:18.6,repeat:-1,ease:'none',paused:true,
        }),
      ]));
      const pulseObserver = new IntersectionObserver(entries=>{
        entries.forEach(entry=>pulses.get(entry.target)?.paused(!entry.isIntersecting));
      });
      pulses.forEach((_,area)=>pulseObserver.observe(area));
      const contourMotion = new Map<Element,{draw:gsap.core.Timeline; drift:gsap.core.Timeline; visible:boolean}>();
      const syncDrift = (animation:{draw:gsap.core.Timeline;drift:gsap.core.Timeline;visible:boolean})=>{
        animation.drift.paused(!animation.visible || animation.draw.progress()<.98);
      };
      const contourObserver = new IntersectionObserver(entries=>{
        entries.forEach(({target,isIntersecting})=>{
          const animation = contourMotion.get(target);
          if (!animation) return;
          animation.visible = isIntersecting;
          syncDrift(animation);
        });
      });
      node.querySelectorAll('[data-iv-draw]').forEach(contour=>{
        const pattern = contour.getAttribute('data-iv-draw');
        const paths = contour.querySelectorAll('path');
        const paired = pattern==='ranking';
        const lineCount = paired ? paths.length/2 : paths.length;
        const middle = (lineCount-1)/2;
        const offset = (index:number)=>{
          const line = paired ? Math.floor(index/2) : index;
          const order = pattern==='insights' ? (lineCount-1-line)/middle : Math.abs(line-middle)/middle;
          const jitter = (Math.sin((line+1)*73.17)+1)*.23;
          return order*.63+jitter;
        };
        const drift = gsap.timeline({paused:true});
        paths.forEach((path,index)=>{
          const line = paired ? Math.floor(index/2) : index;
          const sway = 2.5+Math.abs(Math.sin(line*1.83))*5.5;
          drift.to(path,{
            y:(line%2 ? -1 : 1)*sway,
            duration:3.9+Math.abs(Math.cos(line*.81))*3.4,
            ease:'sine.inOut',repeat:-1,yoyo:true,
          },offset(index));
        });
        const draw = gsap.timeline({
          scrollTrigger:{trigger:contour,start:'top 97%',end:'clamp(bottom 42%)',scrub:1.55},
        });
        const animation = {draw,drift,visible:false};
        draw.eventCallback('onUpdate',()=>syncDrift(animation));
        draw.fromTo(paths,{attr:{'stroke-dasharray':'1 1','stroke-dashoffset':1}},{
          attr:{'stroke-dashoffset':0},duration:3.26,stagger:offset,ease:'sine.inOut',
        });
        contourMotion.set(contour,animation);
        contourObserver.observe(contour);
      });
      let refreshFrame = 0;
      const resizeObserver = new ResizeObserver(()=>{
        cancelAnimationFrame(refreshFrame);
        refreshFrame = requestAnimationFrame(()=>ScrollTrigger.refresh());
      });
      resizeObserver.observe(node);
      return ()=>{
        resizeObserver.disconnect();
        cancelAnimationFrame(refreshFrame);
        revealObserver.disconnect();
        cancelAnimationFrame(frame);
        node.removeEventListener('focusin',revealFocus);
        pulseObserver.disconnect();
        contourObserver.disconnect();
      };
    },node);
    for (const wide of [true,false]) {
      const screen=wide ? '(min-width: 801px)' : '(width < 801px)';
      motion.add(`(prefers-reduced-motion: no-preference) and ${screen}`,()=>{
        const stages=node.querySelectorAll(wide ? '.iv-roadmap-body' : '.iv-roadmap-steps li');
        stages.forEach(stage=>{
          const threads=stage.querySelectorAll(wide ? '.iv-roadmap-contour [data-roadmap-thread]' : '[data-roadmap-thread]');
          const signal=wide ? stage.querySelector('[data-roadmap-signal]') : null;
          const markers=stage.querySelectorAll('.iv-roadmap-marker');
          const draw=gsap.timeline({paused:true});
          if (threads.length) {
            gsap.set(threads,{attr:{'stroke-dasharray':'1 1','stroke-dashoffset':1}});
            draw.to(threads,{attr:{'stroke-dashoffset':0},duration:1.55,stagger:.04,ease:'sine.inOut'},0);
          }
          if (signal) draw.to(signal,{attr:{'stroke-dashoffset':-1},duration:1.61,ease:'sine.inOut'},.06);
          draw.fromTo(markers,{opacity:0,scale:.72,y:6},{opacity:1,scale:1,y:0,duration:.42,stagger:.24,ease:'power2.out'},wide ? .3 : .05);
          ScrollTrigger.create({
            animation:draw,trigger:stage,start:'top 93%',end:wide ? 'clamp(top 48%)' : 'clamp(bottom 70%)',scrub:1.05,
          });
        });
      },node);
    }
    return ()=>motion.revert();
  },[]);

  return <div className="iv-landing" ref={root}>
    <a href="#iv-main" className="iv-skip">Skip to content</a>
    <a data-flow className="iv-announcement" href="#roadmap"><span aria-hidden="true"/><span>Coming soon <b>Social activity in project rankings</b></span><Icon name="right"/></a>
    <header data-flow className="iv-header iv-width">
      <Link className="iv-wordmark" href="/"><BrandMotion/> Invisible</Link>
      <MobileNavigation>
        <nav aria-label="Main navigation">
          <a href="#preview"><Icon name="overview"/>Product</a>
          <a href="#connect"><Icon name="connect"/>Setup</a>
          <a href="#ranking"><Icon name="ranking"/>Methodology</a>
          <a href="#roadmap"><Icon name="growth"/>Roadmap</a>
          <Link className="iv-mobile-route" href="/docs/"><Icon name="research"/>Docs</Link>
          <Link className="iv-mobile-route" href="/app/"><Icon name="dashboard"/>Dashboard</Link>
        </nav>
      </MobileNavigation>
      <div className="iv-header-actions">
        <Link className="iv-route-button" href="/docs/"><Icon name="research"/>Docs</Link>
        <Link className="iv-route-button iv-route-primary" href="/app/" aria-label="Open Dashboard"><Icon name="dashboard"/><span>Dashboard</span></Link>
      </div>
    </header>
    <main id="iv-main">
      <section className="iv-hero" aria-labelledby="iv-title">
        <Contours/>
        <div className="iv-hero-copy">
          <h1 id="iv-title" data-flow><Words text="Tell your agent"/><br/> <Words text="about Invisible."/></h1>
          <p data-flow><Words text="See which NEAR projects people keep using, and give your agent the evidence behind each ranking."/></p>
          <div className="iv-hero-actions">
            <Link data-flow className="iv-primary" href="/app/"><Icon name="dashboard"/> Open dashboard</Link>
            <a data-flow className="iv-secondary" href="#connect"><Icon name="plug"/> Connect your agent</a>
          </div>
        </div>
      </section>
      <DashboardPreview/>
      <IntegrationSetup/>
      <section className="iv-section iv-split iv-insights iv-width" id="insights" data-reveal-section aria-labelledby="iv-insights-title">
        <div className="iv-section-copy" data-reveal>
          <h2 data-flow id="iv-insights-title"><Words text="What brought signers back?"/></h2><p data-flow><Words text="Follow a change in activity down to the contract calls behind it."/></p>
          <SectionContour pattern="insights"/>
        </div>
        <article className="iv-card iv-insight" data-reveal>
          <h3 data-flow>Did signers come back to do the same thing?</h3>
          <ol>
            <li data-flow><strong>Compare the cohorts</strong><span>Find the signers who appeared in both 28-day windows.</span></li>
            <li data-flow><strong>Read the actions</strong><span>Group their function calls by contract and method.</span></li>
            <li data-flow><strong>Check the transactions</strong><span>Open a source transaction to see what executed.</span></li>
          </ol>
          <Link data-flow className="iv-text-link" href="/app/deployments/?sort=repeat">Explore contract evidence <Icon name="launch"/></Link>
        </article>
      </section>
      <section className="iv-section iv-width" id="ranking" data-reveal-section aria-labelledby="iv-method-title">
        <div className="iv-method-head" data-reveal><h2 data-flow id="iv-method-title"><Words text="What moves a project up?"/></h2><Link data-flow className="iv-text-link" href="/docs/#investment-methodology">Read the methodology <Icon name="launch"/></Link></div>
        <div className="iv-ranking-field"><SectionContour pattern="ranking"/><RankingWeights/></div>
      </section>
      <Sources/>
      <Roadmap/>
    </main>
    <footer className="iv-footer iv-width">
      <Link data-flow className="iv-wordmark" href="/"><BrandMotion/> Invisible</Link>
      <nav data-flow className="iv-footer-nav" aria-label="Footer">
        <Link href="/app/"><Icon name="dashboard"/>Dashboard</Link><a href="#roadmap"><Icon name="growth"/>Roadmap</a><Link href="/docs/"><Icon name="research"/>Docs</Link>
      </nav>
      <nav data-flow className="iv-developer-links" aria-label="Developer">
        {developerLinks.map(({href,label,icon})=><a key={icon} href={href} aria-label={label} title={label}>
          <span aria-hidden="true" style={{maskImage:`url(/marks/social/${icon}.svg)`}}/>
        </a>)}
      </nav>
    </footer>
  </div>;
}
