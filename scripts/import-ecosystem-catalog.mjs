import {readFile, rename, writeFile} from 'node:fs/promises';
import registry from '../data/activity-registry.json' with {type:'json'};

const explorer = 'https://nearprotocol.eco/';
const archive = 'https://raw.githubusercontent.com/near/ecosystem/main/entities.json';
const protocols = 'https://api.llama.fi/protocols';
const aliases = new Map(Object.entries({
  reffinance:'rhea', rheafinance:'rhea', rheadex:'rhea', rhealend:'rhea', rhealst:'rhea',
  burrow:'rhea', burrowfinance:'rhea', metapoolnear:'metapool', linearprotocol:'linear',
  inteartradealpha:'intear', stadernearx:'stader', templarlending:'templarprotocol',
  nearbridge:'rainbowbridge', herestaking:'herewallet', herewalletstaking:'herewallet',
  nearblock:'nearblocks', senderwallet:'senderai', daibymakerdao2:'daibymakerdao', neardevhub2:'neardevhub',
}));
const rows = new Map();
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g,'');
const sharedAssets = new Set(['daibymakerdao','usdc','usdt']);
const standaloneMeme = new Set(['whatthehoot','hoodl','jambo','blackdragon','nearkat','zolanear','noearnoear']);

async function fetchSource(url) {
  const result = await fetch(url,{signal:AbortSignal.timeout(30000)});
  if (!result.ok) throw new Error(url+' HTTP '+result.status);
  return result;
}

function add({name, key = name, categories, source, phase, contracts = [], tokens = [], website, projectId}) {
  const id = aliases.get(normalize(key)) ?? normalize(key);
  if (!id) return;
  const row = rows.get(id) ?? {id,name,categories:new Set(),evidence:[],reportedContracts:new Set(),reportedTokens:new Map(),website:null,registryId:null};
  for (const category of categories) if (category) row.categories.add(category.toLowerCase());
  for (const account of contracts) row.reportedContracts.add(account);
  for (const token of tokens) row.reportedTokens.set(token.accountId,token);
  row.evidence.push({source, reportedPhase:phase || null});
  row.website ??= typeof website === 'string' && /^https?:\/\//i.test(website) ? website : null;
  if (projectId) {
    row.registryId = projectId;
    row.name = name;
  }
  rows.set(id,row);
}

const [mapResponse, archiveResponse, protocolsResponse] = await Promise.all([explorer,archive,protocols].map(fetchSource));
const html = await mapResponse.text();
const context = html.match(/window\.__remixContext = ([\s\S]*?);<\/script>/)?.[1];
const map = context ? JSON.parse(context).state?.loaderData?.['routes/_index']?.categories : null;
const archived = await archiveResponse.json();
const listed = await protocolsResponse.json();
if (!map || !Array.isArray(archived) || !Array.isArray(listed)) throw new Error('Unexpected catalog source format');

for (const project of registry) {
  add({name:project.name,key:project.id,projectId:project.id,categories:[project.category],contracts:Object.keys(project.contracts),tokens:project.tokens.map(({accountId,symbol})=>({accountId,symbol})),
    source:'https://github.com/0xmugetso/invisible/blob/main/data/activity-registry.json',
    website:project.links.website,phase:'verified registry'});
}
for (const [category,{projects}] of Object.entries(map)) {
  for (const project of projects) {
    add({name:project.name,key:project.id,categories:[category],source:explorer+'category/'+category,phase:typeof project.phase === 'string' ? project.phase : null,website:project.dapp,
      tokens:Object.values(project.tokens ?? {}).flatMap(token => {
        const accountId=token.address?.near;
        return token.symbol && typeof accountId === 'string' && /^[a-z0-9_.-]{2,64}$/.test(accountId)
          ? [{accountId,symbol:token.symbol}] : [];
      })});
  }
}
for (const project of archived) {
  add({name:project.title,key:project.slug,categories:(project.category ?? '').split(',').map(value=>value.trim()),
    source:'https://github.com/near/ecosystem/blob/main/entities.json',website:project.website,phase:project.status,
    contracts:(project.contract ?? '').split(/[,\s]+/).filter(account=>/^[a-z0-9_.-]+\.near$/.test(account))});
}
for (const protocol of listed.filter(protocol=>protocol.chains?.includes('Near'))) {
  add({name:protocol.name,categories:[protocol.category],source:'https://defillama.com/protocol/'+protocol.slug,website:protocol.url});
}

const deploymentSnapshot = JSON.parse(await readFile(new URL('../public/deployments.json',import.meta.url),'utf8'));
const deploymentRows = new Map(deploymentSnapshot.rows.map(row=>[row[0],row]));
const projects = [...rows.values()].map(row => ({
  ...row, categories:[...row.categories].sort(), reportedContracts:[...row.reportedContracts].sort(),
  reportedTokens:[...row.reportedTokens.values()],
  deploymentMatches:[...row.reportedContracts].flatMap(account => {
    const deployment = deploymentRows.get(account);
    return deployment ? [{account, signers:deployment[3], previousSigners:deployment[2], repeatSigners:deployment[5]}] : [];
  }),
  evidence:[...new Map(row.evidence.map(item=>[item.source,item])).values()],
  status:row.registryId ? 'verified_registry' : standaloneMeme.has(row.id) ? 'excluded_standalone_meme' : sharedAssets.has(row.id) ? 'excluded_shared_asset' : 'needs_product_review',
})).sort((a,b)=>a.name.localeCompare(b.name));
const snapshot = {collectedAt:new Date().toISOString(),sources:[explorer,archive,protocols],deploymentCutoff:deploymentSnapshot.end,projects};
const target = new URL('../data/ecosystem-catalog.json',import.meta.url);
const temporary = new URL(target.href+'.tmp');
await writeFile(temporary,JSON.stringify(snapshot)+'\n');
await rename(temporary,target);
console.log(JSON.stringify(Object.fromEntries(Object.entries(Object.groupBy(projects,row=>row.status)).map(([status,rows])=>[status,rows.length]))));
