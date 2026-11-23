import {socialResearchIndex,socialResearch} from '../services/social-research.mjs';
const board=socialResearchIndex();
console.log(JSON.stringify({
  methodology:board.methodology,
  coverage:{projects:board.projects.length,withDatedEvidence:board.projects.filter(p=>p.sources.some(s=>s.sampleCount)).length},
  projects:board.projects.map(project=>socialResearch(project.id)),
},null,2));
