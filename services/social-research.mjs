import evidence from '../data/social-evidence.json' with {type:'json'};
import {analyzeProjectSocial,socialMethodology} from './social-analysis.mjs';

export function socialResearch(id, now=new Date()) {
  const project=evidence.projects.find(project=>project.id===id);
  if (!project) return null;
  const observedAt=project.observedAt ?? evidence.updatedAt;
  return {
    ...analyzeProjectSocial(project,observedAt),
    stale:now.getTime()-Date.parse(observedAt)>72*3600000,
    collectedBy:evidence.collector,
    rankingEffect:'research_only',
  };
}

export function socialResearchIndex() {
  return {
    methodology:socialMethodology,updatedAt:evidence.updatedAt,
    scope:'Mapped non-meme NEAR projects. Token and non-token projects are identified separately.',
    projects:evidence.projects.map(({id})=>{
      const result=socialResearch(id);
      return {
        id,name:result.name,tokenVerified:result.tokenVerified,status:result.status,observedAt:result.observedAt,
        stale:result.stale,sources:result.sources.map(({platform,url,status,sampleCount,score,error,coverage})=>({
          platform,url,status,sampleCount,score,error,coverage,
        })),
      };
    }),
  };
}

export async function readStoredSocial(db,id) {
  try {
    const {rows:[record]}=await db.query(
      'SELECT evidence,observed_at,last_attempt_at,last_attempt FROM invisible.social_evidence WHERE project_id=$1',[id]);
    if (!record) return socialResearch(id);
    return {
      ...record.evidence,
      stale:Date.now()-new Date(record.observed_at).getTime()>72*3600000,
      lastAttemptAt:record.last_attempt_at,lastAttemptStatus:record.last_attempt?.status,
      rankingEffect:'research_only',
    };
  } catch (error) {
    if (error.code!=='42P01') throw error;
    return socialResearch(id);
  }
}
