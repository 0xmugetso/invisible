import {randomUUID} from 'node:crypto';
import {appOrigin} from '../services/integration-origin.mjs';
import {findProjects,readPublishedResearch,returningSigners} from '../services/research-read.mjs';

function agentCard() {
  const origin=appOrigin();
  return {
    name:'Invisible NEAR Research',description:'Read-only research on NEAR projects, returning signers and verified contract evidence.',
    protocolVersion:'0.3.0',version:'1.0.0',url:origin+'/api/a2a',preferredTransport:'JSONRPC',
    documentationUrl:origin+'/docs/#a2a',capabilities:{streaming:false,pushNotifications:false,stateTransitionHistory:false},
    defaultInputModes:['text/plain','application/json'],defaultOutputModes:['text/plain','application/json'],
    skills:[
      {id:'returning-signers',name:'Returning Signers',description:'Compare measured signer overlap across two 28-day windows.',tags:['near','rankings'],examples:['Which NEAR projects brought the most signers back?']},
      {id:'project-evidence',name:'Project Evidence',description:'Search the NEAR catalog or retrieve evidence for a verified project ID.',tags:['near','evidence'],examples:['Find projects matching Rhea','Project evidence: rhea']},
    ],
  };
}

export default async function handler(request,response) {
  response.setHeader('Access-Control-Allow-Origin','*');
  if (request.method==='GET') {
    response.setHeader('Cache-Control','public, max-age=300');
    return response.status(200).json(agentCard());
  }
  response.setHeader('Cache-Control','no-store');
  if (request.method==='OPTIONS') {
    response.setHeader('Access-Control-Allow-Headers','Content-Type, A2A-Version');
    response.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    return response.status(204).end();
  }
  if (request.method!=='POST') return response.status(405).end();
  const {jsonrpc,method,id,params}=request.body ?? {};
  const send=payload=>response.status(200).json({jsonrpc:'2.0',id:id ?? null,...payload});
  const fail=(code,message)=>send({error:{code,message}});
  if (jsonrpc!=='2.0' || !['string','number'].includes(typeof id)) return fail(-32600,'Invalid Request');
  if (method!=='message/send') return fail(-32601,'Method not found');
  const message=params?.message;
  if (message?.kind!=='message' || message.role!=='user' || typeof message.messageId!=='string' || !Array.isArray(message.parts) || message.parts.length>12) return fail(-32602,'A user message is required');
  const text=message.parts.filter(part=>part?.kind==='text' && typeof part.text==='string').map(part=>part.text).join(' ').trim();
  if (text.length>1000) return fail(-32602,'Message too long');
  const data=message.parts.find(part=>part?.kind==='data')?.data;
  const projectId=data?.projectId ?? text.match(/^project evidence:\s*([a-z0-9-]{1,64})$/i)?.[1]?.toLowerCase();
  const query=data?.query ?? text.match(/^find projects matching\s+(.+)$/i)?.[1];
  try {
    let result;
    if (projectId!==undefined) {
      if (typeof projectId!=='string' || !/^[a-z0-9-]{1,64}$/.test(projectId)) return fail(-32602,'Invalid project ID');
      result=await readPublishedResearch('project-core',projectId) ?? {error:'Verified project not found'};
    } else if (query!==undefined) {
      if (typeof query!=='string' || !query.trim() || query.length>100) return fail(-32602,'Invalid search query');
      result=findProjects(query);
    } else if (data?.metric==='returning' || /returning signers|signers back|signers returned/i.test(text)) {
      result=await returningSigners();
    }
    return send({result:{
      kind:'message',role:'agent',messageId:randomUUID(),
      parts:result ? [{kind:'data',data:result}] : [{kind:'text',text:'Ask which projects brought the most signers back, use “Find projects matching Rhea”, or send “Project evidence: rhea”.'}],
    }});
  } catch {
    return fail(-32603,'Research data is temporarily unavailable');
  }
}
