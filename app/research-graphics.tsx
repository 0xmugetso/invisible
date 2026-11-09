'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {gsap} from 'gsap';

const format = (value: number) => new Intl.NumberFormat('en', {maximumFractionDigits: 2}).format(value);

export function ResearchChart({values, label, split = false, days = [], bars = false, stepped = false}: {
  values: number[];
  label: string;
  split?: boolean;
  days?: string[];
  bars?: boolean;
  stepped?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const clip = useRef<SVGRectElement>(null);
  const clipId = useId();
  const [active, setActive] = useState<number | null>(null);
  const width = 700;
  const height = 138;
  const peak = Math.max(1, ...values);
  const step = 10 ** Math.floor(Math.log10(peak / 3));
  const max = Math.ceil(peak / (3 * step)) * 3 * step;
  const scale = (n: number) => height - n / max * (height - 5);
  const position = (i: number) => bars ? (i + .5) * width / values.length : i * width / (values.length - 1);
  const points = values.map((n, i) => {
    const point = `${position(i)},${scale(n)}`;
    return stepped && i > 0 ? `${position(i)},${scale(values[i - 1])} ${point}` : point;
  }).join(' ');
  const seriesKey = values.join(',');
  const ready = values.length >= 2;

  useEffect(() => {
    if (!clip.current) return;
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)', () => {
      const mask = clip.current;
      if (!mask) return;
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        gsap.fromTo(mask, {attr: {width: 0}}, {attr: {width}, duration: .85, ease: 'power2.out', overwrite: true});
      });
      observer.observe(mask.ownerSVGElement!);
      return () => {
        observer.disconnect();
        gsap.killTweensOf(mask);
        mask.setAttribute('width', String(width));
      };
    }, root);
    return () => motion.revert();
  }, [seriesKey, bars]);

  if (!ready) return <div className="empty-chart">No series available</div>;

  const selected = active !== null && active < values.length ? active : null;
  return (
    <div className="research-chart" ref={root}>
      <div className="chart-ticks" aria-hidden="true">{[max, max * 2 / 3, max / 3, 0].map(tick => <span key={tick}>{format(tick)}</span>)}</div>
      <div className="chart-plot" tabIndex={0} role="group" aria-label={label + '. Use arrow keys to inspect each day.'}
        onFocus={() => setActive(values.length - 1)}
        onBlur={() => setActive(null)}
        onPointerMove={event => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const fraction = (event.clientX - bounds.left) / bounds.width;
          setActive(Math.max(0, Math.min(values.length - 1, Math.round(fraction * (values.length - 1)))));
        }}
        onPointerLeave={() => setActive(null)}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          setActive(current => {
            if (event.key === 'Home') return 0;
            if (event.key === 'End') return values.length - 1;
            return Math.min(values.length - 1, Math.max(0, (current ?? values.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1)));
          });
        }}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs><clipPath id={clipId}><rect ref={clip} width={width} height={height}/></clipPath></defs>
          {[0, 1, 2, 3].map(i => <line key={i} x1="0" x2={width} y1={scale(max * i / 3)} y2={scale(max * i / 3)} className="chart-gridline"/>)}
          {split && <line x1={width / 2} x2={width / 2} y1="0" y2={height} className="chart-split"/>}
          <g clipPath={`url(#${clipId})`}>
            {bars ? values.map((n, i) => <rect key={i} x={position(i) - width / values.length * .33} y={scale(n)} width={width / values.length * .66} height={height - scale(n)} fill="currentColor" opacity={i < values.length / 2 ? .4 : .85}/>) :
              <>
                <polygon points={`0,${height} ${points} ${width},${height}`} fill="currentColor" opacity=".09"/>
                <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
              </>}
          </g>
          {selected !== null && <line x1={position(selected)} x2={position(selected)} y1="0" y2={height} className="chart-cursor"/>}
        </svg>
        {selected !== null && <div className="chart-tooltip" style={{left: `${Math.min(100, Math.max(0, position(selected) / width * 100))}%`}} data-edge={selected < values.length / 4 ? 'start' : selected > values.length * .75 ? 'end' : 'middle'}>
          {days[selected] ?? `Day ${selected + 1}`} <strong>{format(values[selected])}</strong>
        </div>}
        <span className="sr-only" aria-live="polite">{selected !== null ? `${days[selected] ?? `Day ${selected + 1}`}: ${format(values[selected])}` : ''}</span>
      </div>
    </div>
  );
}

export function ContributionChart({rows}: {rows: {name: string; delta: number}[]}) {
  const root = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...rows.map(row => Math.abs(row.delta)));
  const dataKey = rows.map(row => row.delta).join(',');

  useEffect(() => {
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)', () => {
      const node = root.current;
      if (!node) return;
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        gsap.fromTo(node.querySelectorAll('.delta-bar'), {scaleX: 0}, {scaleX: 1, duration: .55, stagger: .025, ease: 'power3.out', overwrite: true});
      });
      observer.observe(node);
      return () => {
        observer.disconnect();
        const bars = node.querySelectorAll('.delta-bar');
        gsap.killTweensOf(bars);
        bars.forEach(bar => (bar as HTMLElement).style.removeProperty('transform'));
      };
    });
    return () => motion.revert();
  }, [dataKey]);

  return <div ref={root} className="delta-chart">{rows.map(row => (
    <div className="delta-row" key={row.name}>
      <span>{row.name}</span>
      <div className="delta-track" aria-hidden="true">
        <i className={`delta-bar ${row.delta < 0 ? 'negative' : 'positive'}`} style={{width: `${Math.abs(row.delta) / max * 50}%`}}/>
      </div>
      <strong>{row.delta > 0 ? '+' : ''}{format(row.delta)}</strong>
    </div>
  ))}</div>;
}

export function ReturningShare({prior, current, repeat}: {prior:number; current:number; repeat:number}) {
  const max = Math.max(1, prior, current);
  return (
    <section className="panel retention-panel">
      <h2>Who came back?</h2>
      <p>{format(repeat)} signers appeared in both 28-day windows.</p>
      {[['Previous window',prior],['Current window',current]].map(([label,total])=>(
        <div className="retention-row" key={label}>
          <span>{label}</span>
          <div className="retention-track" aria-hidden="true">
            <div style={{width:`${Number(total)/max*100}%`}}><i style={{width:`${Number(total)?repeat/Number(total)*100:0}%`}}/></div>
          </div>
          <strong>{format(Number(total))}</strong>
        </div>
      ))}
      <p className="retention-legend"><span><i/> Appeared in both windows</span><span><i/> Appeared in one window</span></p>
    </section>
  );
}

export function CountUp({value}: {value:string|number}) {
  const visual = useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    const node = visual.current;
    const match = String(value).match(/^([+-]?)(\d[\d,]*)(%| NEAR)?$/);
    if (!node || !match) return;
    const [,sign,digits,unit=''] = match;
    const target = Number(digits.replaceAll(',',''));
    const state = {number:0};
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)',()=>{
      gsap.to(state,{number:target,duration:.85,ease:'power3.out',onUpdate:()=>{
        node.textContent = sign+format(Math.round(state.number))+unit;
      },onComplete:()=>{node.textContent=String(value);}});
    });
    return ()=>{motion.revert();node.textContent=String(value);};
  },[value]);
  return <><span className="sr-only">{value}</span><span ref={visual} aria-hidden="true">{value}</span></>;
}

export function CohortSculpture({counts,unit='distinct signers',period='28-day',labels=['First','Previous','Latest']}: {counts:[number,number,number];unit?:string;period?:string;labels?:[string,string,string]}) {
  const ref = useRef<SVGSVGElement>(null);
  const max = Math.max(1,...counts);
  useEffect(()=>{
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)',()=>{
      gsap.from('[data-cohort-object]',{y:14,opacity:.15,duration:.75,stagger:.12,ease:'power3.out'});
    },ref);
    return ()=>motion.revert();
  },[counts[0],counts[1],counts[2]]);
  return <svg ref={ref} className="cohort-object" viewBox="0 0 340 195" role="img" aria-label={`Three ${period} windows: ${counts.map(format).join(', ')} ${unit}`}>
    <path d="M12 166H328" stroke="currentColor" opacity=".28"/>
    {counts.map((count,i)=>{
      const x=29+i*111, height=count/max*106, y=151-height;
      return <g key={i} data-cohort-object="">
        <path d={`M${x} ${y}l31 14 31-14v${height}l-31 14-31-14z`} fill={i===2?'#17805e':'#506f63'} stroke="#b0d0c0" strokeWidth=".6"/>
        <path d={`M${x+31} ${y+14}l31-14v${height}l-31 14z`} fill="#133d32" opacity=".65"/>
        <path d={`M${x} ${y}l31-14 31 14-31 14z`} fill={i===2?'#a2f6ce':'#9fbbaf'}/>
        <text x={x+31} y={Math.max(16,y-18)} textAnchor="middle" fill="currentColor" fontSize="11">{format(count)}</text>
        <text x={x+31} y="187" textAnchor="middle" fill="currentColor" fontSize="10">{labels[i]}</text>
      </g>;
    })}
  </svg>;
}
