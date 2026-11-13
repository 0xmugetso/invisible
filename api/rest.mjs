import research from './research.mjs';
import {returningSigners} from '../services/research-read.mjs';

const resources = {
  projects:'ecosystem',
  project:'project-core',
  market:'project-market',
  rankings:'leaderboard',
  investment:'investment',
  forecast:'forecast',
};

export default async function handler(request,response) {
  response.setHeader('Access-Control-Allow-Origin','*');
  response.setHeader('Allow','GET, OPTIONS');
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
    return response.status(204).end();
  }
  if (request.method !== 'GET') return response.status(405).json({error:'Use GET for research data'});
  const {resource,id,q,page,limit='10'}=request.query;
  if (resource==='returning') {
    if (typeof limit!=='string' || !/^(?:[1-9]|1[0-9]|20)$/.test(limit)) return response.status(400).json({error:'limit must be between 1 and 20'});
    try {
      const result=await returningSigners(Number(limit));
      response.setHeader('Cache-Control','public, max-age=15, s-maxage=60');
      return response.status(200).json(result);
    } catch {
      return response.status(503).json({error:'Research data is temporarily unavailable'});
    }
  }
  if (typeof resource!=='string' || !Object.hasOwn(resources,resource)) return response.status(404).json({error:'Unknown research resource'});
  return research({method:'GET',query:{view:resources[resource],id,q,page}},response);
}
