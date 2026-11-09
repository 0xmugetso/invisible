// An abstract routing diagram. The traces are decorative, so they carry no data labels.
export default function NetworkBackground() {
  const traces = Array.from({length: 27}, (_, index) => {
    const offset = (index - 13) * 13;
    return `M -60 ${360 + offset * .44} C 142 ${364 + offset * .5} 224 ${118 + offset * .58} 439 ${130 + offset * .75} S 670 ${360 + offset} 819 ${287 + offset * 1.1} S 962 ${54 + offset * .55} 1130 ${31 + offset * .65}`;
  });

  return <div className="network-background" aria-hidden="true">
    <svg viewBox="0 0 1080 560" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trace-ink" x2="1" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity=".42"/>
          <stop offset=".38" stopColor="currentColor" stopOpacity=".48"/>
          <stop offset=".73" stopColor="currentColor"/>
          <stop offset="1" stopColor="currentColor" stopOpacity=".5"/>
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#trace-ink)">
        {traces.map((path, index) => <path key={path} d={path} vectorEffect="non-scaling-stroke" strokeWidth={index % 6 === 0 ? 1.35 : .7} opacity={index % 6 === 0 ? .85 : .47}/>)}
      </g>
      <g className="network-pulses" fill="none" stroke="currentColor">
        {[5, 11, 17, 23].map(index => <path key={index} d={traces[index]} pathLength="100" strokeWidth="1.8" strokeLinecap="round"/>)}
      </g>
    </svg>
  </div>;
}
