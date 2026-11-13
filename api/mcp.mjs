import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {z} from 'zod';
import {appOrigin} from '../services/integration-origin.mjs';
import {findProjects,readPublishedResearch,returningSigners} from '../services/research-read.mjs';

const jsonResult = data=>({content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data});
const readOnly = {readOnlyHint:true,openWorldHint:true};

export default async function handler(request,response) {
  const origin=request.headers.origin;
  if (origin && origin!==appOrigin()) return response.status(403).end();
  if (request.method!=='POST') {
    response.setHeader('Allow','POST');
    return response.status(405).end();
  }
  response.setHeader('Cache-Control','no-store');
  const server = new McpServer({name:'invisible',version:'1.0.0'});
  server.registerTool('search_projects',{
    description:'Find NEAR projects by name, identifier, or contract. Search results include coverage and source evidence.',
    inputSchema:{query:z.string().trim().min(1).max(100),page:z.number().int().min(1).max(999999).default(1)}, annotations:readOnly,
  },async ({query,page})=>jsonResult(findProjects(query,page)));
  server.registerTool('get_project_evidence',{
    description:'Read the verified deployment sources, signer cohorts, activity score, and tokenomics for a registry project.',
    inputSchema:{id:z.string().regex(/^[a-z0-9-]{1,64}$/)},annotations:readOnly,
  },async ({id})=>{
    const result=await readPublishedResearch('project-core',id);
    return result ? jsonResult(result) : {isError:true,content:[{type:'text',text:'Project not found in the verified registry.'}]};
  });
  server.registerTool('get_rankings',{
    description:'Get published activity or investment rankings, or order eligible projects by returning signers. Results include the snapshot cutoff.',
    inputSchema:{metric:z.enum(['returning','activity','investment']).default('returning'),limit:z.number().int().min(1).max(20).default(10)},annotations:readOnly,
  },async ({metric,limit})=>{
    if (metric==='returning') return jsonResult(await returningSigners(limit));
    const board=await readPublishedResearch(metric==='activity' ? 'leaderboard' : metric);
    const rank=metric==='investment' ? 'performanceRank' : 'activityRank';
    return jsonResult({...board,projects:board.projects.filter(project=>project[rank]!=null).sort((a,b)=>a[rank]-b[rank]).slice(0,limit)});
  });
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  response.once('close',()=>{void server.close();});
  await server.connect(transport);
  await transport.handleRequest(request,response,request.body);
}
