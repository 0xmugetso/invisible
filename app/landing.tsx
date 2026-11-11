'use client';

import {useEffect, useRef, useState, type KeyboardEvent, type RefObject} from 'react';
import Link from 'next/link';
import {gsap} from 'gsap';
import {networkTraces} from './network-background';

const api = 'https://invisible-gray.vercel.app';
const rankingPath = '/api/research?view=investment';
const prompt = 'Which NEAR projects brought the most signers back? Show me the evidence.';
const integrations = {
  MCP: [
    {env:'Claude Code', steps:[['Add the server','claude mcp add --transport http invisible <MCP_SERVER_URL>'],['Ask about returning signers',prompt]]},
    {env:'Cursor', steps:[['Add the server in .cursor/mcp.json',JSON.stringify({mcpServers:{invisible:{url:'<MCP_SERVER_URL>'}}},null,2)],['Ask in Agent chat',prompt]]},
  ],
  API: [
    {env:'cURL', steps:[['Set the base URL',`export INVISIBLE_URL='${api}'`],['Fetch the investment ranking',`curl -fsS "$INVISIBLE_URL${rankingPath}"`]]},
    {env:'JavaScript', steps:[['Set the base URL',`const base = "${api}";`],['Fetch the investment ranking',`const response = await fetch(base + "${rankingPath}");\nif (!response.ok) throw new Error(response.statusText);\nconsole.log(await response.json());`]]},
  ],
  A2A: [
    {env:'Python', steps:[['Set the agent card URL','agent_card_url = "<AGENT_CARD_URL>"'],['Read the agent card','import json\nfrom urllib.request import urlopen\n\nwith urlopen(agent_card_url) as response:\n    agent_card = json.load(response)']]},
    {env:'JavaScript', steps:[['Set the agent card URL','const agentCardUrl = "<AGENT_CARD_URL>";'],['Read the agent card','const response = await fetch(agentCardUrl);\nif (!response.ok) throw new Error(response.statusText);\nconst agentCard = await response.json();']]},
  ],
};

function usePanelReveal(ref:RefObject<HTMLElement|null>, selection:string|number) {
  useEffect(()=>{
    const node = ref.current;
    if (!node) return;
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)',()=>{
      gsap.fromTo(node.children,{y:5,opacity:.45},{y:0,opacity:1,duration:.3,stagger:.035,clearProps:'opacity,transform'});
    });
    return ()=>motion.revert();
  },[ref,selection]);
}

function Tabs({id,label,items,active,onChange}:{id:string; label:string; items:string[]; active:number; onChange:(index:number)=>void}) {
  function move(event:KeyboardEvent<HTMLDivElement>) {
    const keys:Record<string,number> = {ArrowLeft:(active+items.length-1)%items.length,ArrowRight:(active+1)%items.length,Home:0,End:items.length-1};
    const index = keys[event.key];
    if (index == null) return;
    event.preventDefault();
    onChange(index);
    event.currentTarget.querySelectorAll('button')[index]?.focus();
  }
  return <div className="iv-switch" role="tablist" aria-label={label} onKeyDown={move}>
    {items.map((item,index)=><button key={index} id={`${id}-${index}`} type="button" role="tab" aria-selected={active===index}
      aria-controls={`${id}-panel`} tabIndex={active===index ? 0 : -1} onClick={()=>onChange(index)}>{item}</button>)}
  </div>;
}

function IntegrationSetup() {
  const protocols = Object.keys(integrations) as (keyof typeof integrations)[];
  const [protocolIndex,setProtocol] = useState(0);
  const [envIndex,setEnv] = useState(0);
  const [copyStatus,setCopyStatus] = useState('');
  const protocol = protocols[protocolIndex];
  const variants = integrations[protocol];
  const variant = variants[envIndex];
  const stepPanel = useRef<HTMLDivElement>(null);
  usePanelReveal(stepPanel, variant.env+protocol);

  async function copy(code:string,index:number) {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus(`Step ${index+1} copied`);
    } catch {
      setCopyStatus('Clipboard unavailable. Select the code to copy it.');
    }
  }

  return <section className="iv-section iv-split iv-width" id="connect" data-reveal-section aria-labelledby="iv-connect-title">
    <div className="iv-section-copy" data-reveal><h2 id="iv-connect-title">Connect your agent in two steps</h2><p>Pick a protocol and an environment to see the setup.</p></div>
    <div className="iv-setup" data-reveal>
      <Tabs id="iv-protocol" label="Protocol" items={protocols} active={protocolIndex} onChange={index=>{setProtocol(index);setEnv(0);setCopyStatus('');}}/>
      <div className="iv-editor iv-card" id="iv-protocol-panel" role="tabpanel" aria-labelledby={`iv-protocol-${protocolIndex}`}>
        <div className="iv-editor-top">
          <Tabs id="iv-env" label="Environment" items={variants.map(item=>item.env)} active={envIndex} onChange={index=>{setEnv(index);setCopyStatus('');}}/>
          {protocol!=='API' && <span>Setup preview</span>}
        </div>
        <div className="iv-steps" ref={stepPanel} id="iv-env-panel" role="tabpanel" aria-labelledby={`iv-env-${envIndex}`}>
          {protocol!=='API' && <p className="iv-setup-note">The {protocol} endpoint is pending. The example shows where its URL will go.</p>}
          {variant.steps.map(([title,code],index)=><div className="iv-step" key={index}>
            <div><h3>{index+1}. {title}</h3><button className="iv-outline" type="button" onClick={()=>void copy(code,index)} aria-label={`Copy step ${index+1}`}>Copy</button></div>
            <pre><code>{code}</code></pre>
          </div>)}
          <p className="iv-copy-status" role="status">{copyStatus}</p>
        </div>
      </div>
    </div>
  </section>;
}

function Contours() {
  return <div className="iv-contours" aria-hidden="true">
    {['left','right'].map((side,sideIndex)=><svg className={`iv-contours-${side}`} key={side} viewBox="0 0 560 1080" preserveAspectRatio="none">
      <g transform="translate(560 0) rotate(90)" fill="none" stroke="currentColor">
        {networkTraces.map((trace,index)=><path key={index} d={trace} opacity={index%5===0 ? .28 : .13} vectorEffect="non-scaling-stroke"/>)}
        {[5,12,20].map((index)=><path key={index} data-iv-trace d={networkTraces[index]} pathLength="100" strokeDasharray="7 93"
          strokeDashoffset={14+index*4+sideIndex*13} vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity=".7"/>)}
      </g>
    </svg>)}
  </div>;
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    if (params.get('data')==='demo' || params.get('data')==='observed') {
      window.location.replace('/discovery/'+window.location.search+window.location.hash);
      return;
    }
    const node = root.current;
    if (!node) return;
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)',context=>{
      const reveal = (elements:NodeListOf<Element>) => gsap.fromTo(elements,{y:15,opacity:0},{
        y:0,opacity:1,duration:.65,stagger:.08,ease:'power3.out',clearProps:'opacity,transform',
      });
      const introduction = reveal(node.querySelectorAll('[data-reveal-hero]'));
      const revealObserver = new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if (!entry.isIntersecting) return;
          context.add(()=>{ reveal(entry.target.querySelectorAll('[data-reveal]')); });
          revealObserver.unobserve(entry.target);
        });
      },{threshold:.08});
      node.querySelectorAll('[data-reveal-section]').forEach(section=>revealObserver.observe(section));
      const pulses = gsap.to(node.querySelectorAll('[data-iv-trace]'),{
        attr:{'stroke-dashoffset':(_index:number,path:SVGPathElement)=>Number(path.getAttribute('stroke-dashoffset'))-100},
        duration:12,repeat:-1,ease:'none',paused:true,
      });
      const heroObserver = new IntersectionObserver(([entry])=>pulses.paused(!entry.isIntersecting));
      const hero = node.querySelector('.iv-hero');
      if (hero) heroObserver.observe(hero);
      return ()=>{
        introduction.revert();
        revealObserver.disconnect();
        heroObserver.disconnect();
      };
    },node);
    return ()=>motion.revert();
  },[]);

  return <div className="iv-landing" ref={root}>
    <a href="#iv-main" className="iv-skip">Skip to content</a>
    <header className="iv-header iv-width">
      <Link className="iv-wordmark" href="/"><i aria-hidden="true"/> Invisible</Link>
      <nav aria-label="Main navigation"><a href="#preview">Product</a><a href="#connect">Setup</a></nav>
      <Link className="iv-workspace-link" href="/dashboard/">Open dashboard <span aria-hidden="true">↗</span></Link>
    </header>
    <main id="iv-main">
      <section className="iv-hero" aria-labelledby="iv-title">
        <Contours/>
        <div className="iv-hero-copy">
          <h1 id="iv-title" data-reveal-hero>Tell your agent<br/> about Invisible.</h1>
          <p data-reveal-hero>See which NEAR projects people keep using, and give your agent the evidence behind each ranking.</p>
          <div className="iv-hero-actions" data-reveal-hero>
            <Link className="iv-primary" href="/dashboard/">Open dashboard <span aria-hidden="true">↗</span></Link>
            <a className="iv-secondary" href="#connect">Connect your agent <span aria-hidden="true">↓</span></a>
          </div>
        </div>
      </section>
      <figure className="iv-preview iv-width" id="preview" data-reveal-section>
        <picture data-reveal>
          <source media="(max-width:530px)" srcSet="/dashboard-preview-mobile.webp" width="430" height="1119"/>
          <img src="/dashboard-preview.webp" alt="Invisible dashboard with verified-project counts, the NEAR leaderboard, and two signer cohort charts." width="1440" height="763" fetchPriority="high"/>
        </picture>
        <figcaption>Dashboard screenshot</figcaption>
      </figure>
      <IntegrationSetup/>
    </main>
    <footer className="iv-footer iv-width"><Link className="iv-wordmark" href="/"><i aria-hidden="true"/> Invisible</Link><Link className="iv-text-link" href="/dashboard/">Open dashboard <span aria-hidden="true">↗</span></Link></footer>
  </div>;
}
