'use client';
import {useEffect,useId,useLayoutEffect,useRef,useState,type KeyboardEvent,type RefObject} from 'react';
import Link from 'next/link';
import {gsap} from 'gsap';
import Icon,{type IconName} from './interface-icon';

const api = 'https://invisible-gray.vercel.app';
const rankingPath = '/api/v1/returning-signers?limit=10';
const prompt = 'Which NEAR projects brought the most signers back? Show me the evidence.';
const a2aRequest = {jsonrpc:'2.0',id:1,method:'message/send',params:{message:{
  kind:'message',role:'user',messageId:'invisible-example-1',parts:[{kind:'text',text:prompt}],
}}};
const agentMarks:Record<string,string>={
  'Claude Code':'/marks/agents/claude.png',
  Cursor:'/marks/agents/cursor.svg',
  Codex:'/marks/agents/codex.png',
  Antigravity:'/marks/agents/antigravity.svg',
};
const integrations = {
  MCP: [
    {env:'Claude Code', steps:[['Add the server',`claude mcp add --transport http invisible ${api}/api/mcp`],['Ask in chat',prompt]]},
    {env:'Cursor', steps:[['Add the server in .cursor/mcp.json',JSON.stringify({mcpServers:{invisible:{url:api+'/api/mcp'}}},null,2)],['Ask in Agent chat',prompt]]},
    {env:'Codex', steps:[['Add the server in your terminal',`codex mcp add invisible --url ${api}/api/mcp`],['Ask in a new Codex session',prompt]]},
    {env:'Antigravity', steps:[['Add to MCP Servers → Manage → View Raw Config',JSON.stringify({mcpServers:{invisible:{serverUrl:api+'/api/mcp'}}},null,2)],['Reload MCP servers and ask in chat',prompt]]},
  ],
  'REST API': [
    {env:'cURL', steps:[['Read the returning signer ranking',`curl -fsS '${api}${rankingPath}'`],['Inspect a project',`curl -fsS '${api}/api/v1/projects/rhea'`]]},
    {env:'JavaScript', steps:[['Fetch returning signers',`const response = await fetch("${api}${rankingPath}");\nif (!response.ok) throw new Error(response.statusText);\nconst ranking = await response.json();`],['Read the project evidence',`const evidence = await fetch("${api}/api/v1/projects/rhea");\nif (!evidence.ok) throw new Error(evidence.statusText);\nconsole.log(await evidence.json());`]]},
  ],
  A2A: [
    {env:'cURL', steps:[['Discover the agent',`curl -fsS '${api}/.well-known/agent-card.json'`],['Send a research request',`curl -fsS '${api}/api/a2a' \\\n  -H 'Content-Type: application/json' \\\n  --data '${JSON.stringify(a2aRequest)}'`]]},
    {env:'JavaScript', steps:[['Discover the agent',`const discovery = await fetch("${api}/.well-known/agent-card.json");\nif (!discovery.ok) throw new Error(discovery.statusText);\nconst agent = await discovery.json();`],['Send a research request',`const response = await fetch(agent.url, {\n  method: "POST",\n  headers: {"Content-Type": "application/json"},\n  body: JSON.stringify(${JSON.stringify(a2aRequest, null, 2)})\n});\nif (!response.ok) throw new Error(response.statusText);\nconsole.log(await response.json());`]]},
  ],
  Skill: [
    {env:'Codex', steps:[['Install in your project',`mkdir -p .agents/skills/invisible && curl -fsS '${api}/skill/SKILL.md' -o .agents/skills/invisible/SKILL.md`],['Use the skill in a new session',`$invisible ${prompt}`]]},
    {env:'Claude Code', steps:[['Install in your project',`mkdir -p .claude/skills/invisible && curl -fsS '${api}/skill/SKILL.md' -o .claude/skills/invisible/SKILL.md`],['Use the skill in chat',`/invisible ${prompt}`]]},
  ],
};

export function usePanelReveal(ref:RefObject<HTMLElement|null>, selection:string|number) {
  useEffect(()=>{
    const node = ref.current;
    if (!node) return;
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)',()=>{
      gsap.fromTo(node.children,{y:5,opacity:.45},{y:0,opacity:1,duration:0.46,stagger:.035,clearProps:'opacity,transform'});
    });
    return ()=>motion.revert();
  },[ref,selection]);
}

export function Tabs({id,label,items,icons,marks,active,onChange}:{id:string; label:string; items:string[]; icons?:IconName[]; marks?:string[]; active:number; onChange:(index:number)=>void}) {
  function move(event:KeyboardEvent<HTMLDivElement>) {
    const keys:Record<string,number> = {ArrowLeft:(active+items.length-1)%items.length,ArrowRight:(active+1)%items.length,Home:0,End:items.length-1};
    const index = keys[event.key];
    if (index == null) return;
    event.preventDefault();
    onChange(index);
    event.currentTarget.querySelectorAll('button')[index]?.focus({preventScroll:true});
  }
  return <div className="iv-switch" role="tablist" aria-label={label} onKeyDown={move}>
    {items.map((item,index)=><button key={index} id={`${id}-${index}`} type="button" role="tab" aria-selected={active===index}
      aria-controls={`${id}-panel`} tabIndex={active===index ? 0 : -1} onClick={()=>onChange(index)}>{marks ? <img className="iv-source-mark" src={marks[index]} width="19" height="19" alt=""/> : icons && <Icon name={icons[index]}/>} {item}</button>)}
  </div>;
}

function SetupCode({code}:{code:string}) {
  const isCode=/^(?:\{|const\s|curl\s|mkdir\s|claude\s|codex\s)/.test(code);
  const tokens=/https?:\/\/[^\s'"<>]+|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|--?[\w-]+\b|\b(?:const|await|if|throw|new|fetch|curl|mkdir|claude|codex|true|false|null|\d+)\b|[{}\[\]():,;=]/g;
  if (!isCode) return <code>{code}</code>;
  const parts=[];
  let end=0;
  for (const match of code.matchAll(tokens)) {
    const token=match[0];
    const index=match.index;
    parts.push(code.slice(end,index));
    end=index+token.length;
    const kind=token.startsWith('http') ? 'string' : /^["']/.test(token)
      ? /^\s*:/.test(code.slice(end)) ? 'key' : 'string'
      : token.startsWith('-') ? 'flag' : /^\d/.test(token) ? 'number' : /^\w/.test(token) ? 'keyword' : 'punctuation';
    parts.push(<span className={'iv-syntax-'+kind} key={index}>{token}</span>);
  }
  parts.push(code.slice(end));
  return <code>{parts}</code>;
}

export function IntegrationEditor({only}:{only?:keyof typeof integrations}) {
  const uid=useId();
  const protocols = Object.keys(integrations) as (keyof typeof integrations)[];
  const [protocolIndex,setProtocol] = useState(0);
  const [envIndex,setEnv] = useState(0);
  const [copyStatus,setCopyStatus] = useState('');
  const [copiedStep,setCopiedStep] = useState<number|null>(null);
  const protocol = only ?? protocols[protocolIndex];
  const protocolId=uid+'-protocol';
  const envId=uid+'-environment';
  const stepPanel = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const visibleProtocols = only ? [only] : protocols;
  const docsAnchors = {'REST API':'rest',MCP:'mcp',A2A:'a2a',Skill:'skill'};
  const copyError = 'Copy failed. Select the code.';
  usePanelReveal(stepPanel, protocol+envIndex);
  useLayoutEffect(()=>{
    const card = editor.current;
    const panel = stepPanel.current;
    const feedback = status.current;
    if (only || !card || !panel || !feedback) return;
    const measure = ()=>{
      const steps = panel.closest('.iv-steps');
      if (!steps) return;
      const bottom = panel.getBoundingClientRect().bottom;
      feedback.style.top = `${bottom - steps.getBoundingClientRect().top}px`;
      const height = bottom - card.getBoundingClientRect().top + feedback.offsetHeight + 12;
      card.style.setProperty('--iv-editor-height', `${Math.ceil(height)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    observer.observe(panel);
    observer.observe(feedback);
    return ()=>observer.disconnect();
  },[only,protocol,envIndex]);

  async function copy(code:string,index:number) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedStep(index);
      setCopyStatus(`Step ${index+1} copied`);
    } catch {
      setCopyStatus(copyError);
    }
  }

  return <div className="iv-setup" data-reveal>
      {!only && <Tabs id={protocolId} label="Protocol" items={protocols} icons={['connect','api','ecosystem','research']} active={protocolIndex} onChange={index=>{setProtocol(index);setEnv(0);setCopyStatus('');setCopiedStep(null);}}/>}
      <div className="iv-editor iv-card" ref={editor} id={protocolId+'-panel'} role={only ? undefined : 'tabpanel'} aria-labelledby={only ? undefined : `${protocolId}-${protocolIndex}`}>
        {!only && <div className="iv-editor-surface" aria-hidden="true"/>}
        <div className="iv-editor-stack">
          {visibleProtocols.map(item=>{
            const active = item===protocol;
            const environments = integrations[item].map(entry=>entry.env);
            return <div className="iv-editor-top" key={item} data-active={active} inert={!active}>
              <Tabs id={active ? envId : envId+'-'+docsAnchors[item]} label="Environment" items={environments}
                marks={environments.every(name=>agentMarks[name]) ? environments.map(name=>agentMarks[name]) : undefined}
                active={active ? envIndex : 0} onChange={index=>{setEnv(index);setCopyStatus('');setCopiedStep(null);}}/>
              {!only && <Link className="iv-text-link" href={'/docs/#'+docsAnchors[item]}><Icon name="research"/> Docs</Link>}
            </div>;
          })}
        </div>
        <div className="iv-steps">
          <div className="iv-editor-stack">
            {visibleProtocols.flatMap(item=>integrations[item].map((entry,env)=>{
              const active = item===protocol && env===envIndex;
              return <div key={item+':'+entry.env} data-active={active} inert={!active}
                ref={active ? stepPanel : undefined} id={active ? envId+'-panel' : undefined}
                role={active ? 'tabpanel' : undefined} aria-labelledby={active ? `${envId}-${envIndex}` : undefined}>
                {entry.steps.map(([title,code],index)=><div className="iv-step" key={index}>
                  <div><h3>{index+1}. {title}</h3><button className="iv-outline" type="button" onClick={()=>void copy(code,index)} aria-label={`Copy step ${index+1}`}><Icon name={active && copiedStep===index ? 'check' : 'copy'}/>{active && copiedStep===index ? 'Copied' : 'Copy'}</button></div>
                  <pre className={item==='A2A' && index===1 ? 'iv-a2a-request' : undefined}
                    tabIndex={0} aria-label={`Step ${index+1} code`}><SetupCode code={code}/></pre>
                </div>)}
              </div>;
            }))}
          </div>
          <div className="iv-editor-stack iv-copy-status" ref={status}>
            <span aria-hidden="true">{copyError}</span>
            <p role="status">{copyStatus}</p>
          </div>
        </div>
      </div>

    </div>;
}
