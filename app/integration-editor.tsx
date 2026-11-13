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
    event.currentTarget.querySelectorAll('button')[index]?.focus();
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
  const variants = integrations[protocol];
  const variant = variants[envIndex];
  const stepPanel = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const height = useRef(0);
  useLayoutEffect(()=>{
    const panel=editor.current;
    if (!panel) return;
    function measure() {
      if (panel && !panel.style.height) height.current=panel.getBoundingClientRect().height;
    }
    const observer=new ResizeObserver(measure);
    const steps=stepPanel.current;
    if (steps) observer.observe(steps);
    measure();
    return ()=>observer.disconnect();
  },[]);
  useLayoutEffect(()=>{
    const panel=editor.current;
    if (!panel || !height.current || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    panel.style.removeProperty('height');
    const next=panel.getBoundingClientRect().height;
    if (Math.abs(height.current-next)<2) return;
    const motion=gsap.fromTo(panel,{height:height.current},{height:next,duration:0.59,ease:'power3.inOut',clearProps:'height'});
    height.current=next;
    return ()=>{motion.kill();panel.style.removeProperty('height');};
  },[protocolIndex,envIndex]);
  usePanelReveal(stepPanel, variant.env+protocol);

  async function copy(code:string,index:number) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedStep(index);
      setCopyStatus(`Step ${index+1} copied`);
    } catch {
      setCopyStatus('Clipboard unavailable. Select the code to copy it.');
    }
  }

  return <div className="iv-setup" data-reveal>
      {!only && <Tabs id={protocolId} label="Protocol" items={protocols} icons={['connect','api','ecosystem','research']} active={protocolIndex} onChange={index=>{setProtocol(index);setEnv(0);setCopyStatus('');setCopiedStep(null);}}/>}
      <div className="iv-editor iv-card" ref={editor} id={protocolId+'-panel'} role={only ? undefined : 'tabpanel'} aria-labelledby={only ? undefined : `${protocolId}-${protocolIndex}`}>
        <div className="iv-editor-top">
          <Tabs id={envId} label="Environment" items={variants.map(item=>item.env)} marks={variants.every(item=>agentMarks[item.env]) ? variants.map(item=>agentMarks[item.env]) : undefined} active={envIndex} onChange={index=>{setEnv(index);setCopyStatus('');setCopiedStep(null);}}/>
          {!only && <Link className="iv-text-link" href={'/docs/#'+({'REST API':'rest',MCP:'mcp',A2A:'a2a',Skill:'skill'}[protocol])}><Icon name="research"/> Docs</Link>}
        </div>
        <div className="iv-steps" ref={stepPanel} id={envId+'-panel'} role="tabpanel" aria-labelledby={`${envId}-${envIndex}`}>
          {variant.steps.map(([title,code],index)=><div className="iv-step" key={index}>
            <div><h3>{index+1}. {title}</h3><button className="iv-outline" type="button" onClick={()=>void copy(code,index)} aria-label={`Copy step ${index+1}`}><Icon name={copiedStep===index ? 'check' : 'copy'}/>{copiedStep===index ? 'Copied' : 'Copy'}</button></div>
            <pre><SetupCode code={code}/></pre>
          </div>)}
          <p className="iv-copy-status" role="status">{copyStatus}</p>
        </div>
      </div>
    </div>;
}
