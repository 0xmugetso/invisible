import {readFile, rename, writeFile} from 'node:fs/promises';
import registry from '../data/activity-registry.json' with {type:'json'};

const explorer = 'https://nearprotocol.eco/';
const archive = 'https://raw.githubusercontent.com/near/ecosystem/main/entities.json';
const protocols = 'https://api.llama.fi/protocols';
const tokenIndex = 'https://api.coingecko.com/api/v3/coins/list?include_platform=true';
const aliases = new Map(Object.entries({
  aurora2:'aurora', reffinance:'rhea', rheafinance:'rhea', rheadex:'rhea', rhealend:'rhea', rhealst:'rhea',
  burrow:'rhea', burrowfinance:'rhea', metapoolnear:'metapool', linearprotocol:'linear',
  inteartradealpha:'intear', stadernearx:'stader', templarlending:'templarprotocol',
  nearbridge:'rainbowbridge', herestaking:'herewallet', herewalletstaking:'herewallet',
  nearblock:'nearblocks', trustake:'trufin', neartradelol:'neartradeterminal', edgevideoai:'edgevideo', senderwallet:'senderai', daibymakerdao2:'daibymakerdao', neardevhub2:'neardevhub',
  jumboexchange:'jumbo', hotnearwallettelegram:'hotwallet', intellexaiprotocoltoken:'intellex', allbridgezero:'allbridge', allbridgeclassic:'allbridge',
}));
const rows = new Map();
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g,'');
const sharedAssets = new Set(['daibymakerdao','usdc','usdt']);
const reviewedLeads = {
  cosmose:{reason:'The loyalty program is documented. Its reported NEAR address did not resolve as a token in the indexer.',source:'https://near.org/blog/cosmose-ai-transforming-consumer-empowerment-with-ai-and-blockchain'},
  inite:{reason:'The token index has a name match. The product listing provides no verified issuer-to-token link.',source:'https://www.coingecko.com/en/coins/init'},
  nearpad:{reason:'The archived NearPad listing points to nearpad.io. The same-name token belongs to the newer nearpad.family factory.',source:'https://nearpad.family/docs'},
  woox:{reason:'The WOO token exists on multiple chains. The WOO X exchange listing does not establish attributable NEAR product activity.',source:'https://learn.woo.org/all-about-woo-the-token'},
};
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

const [mapResponse, archiveResponse, protocolsResponse, tokenResponse] = await Promise.all([explorer,archive,protocols,tokenIndex].map(fetchSource));
const html = await mapResponse.text();
const context = html.match(/window\.__remixContext = ([\s\S]*?);<\/script>/)?.[1];
const map = context ? JSON.parse(context).state?.loaderData?.['routes/_index']?.categories : null;
const archived = await archiveResponse.json();
const listed = await protocolsResponse.json();
const indexed = await tokenResponse.json();
if (!map || !Array.isArray(archived) || !Array.isArray(listed) || !Array.isArray(indexed)) throw new Error('Unexpected catalog source format');

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
const indexedTokens = indexed.flatMap(({id,name,symbol,platforms}) => {
  const accountId = platforms?.['near-protocol'];
  return typeof accountId === 'string' && /^[a-z0-9_.-]{2,64}$/.test(accountId)
    ? [{id,name,symbol,accountId,source:'https://www.coingecko.com/en/coins/'+encodeURIComponent(id)}] : [];
});
const rankedAssetAccounts = new Set(registry.flatMap(project=>project.tokens.map(token=>token.accountId)));
const indexedByAccount = Object.groupBy(indexedTokens, token=>token.accountId);
const indexedByName = Object.groupBy(indexedTokens, token=>normalize(token.name));
const projects = [...rows.values()].map(row => {
  const reportedTokens = [...row.reportedTokens.values()];
  const exactMatches = [...row.reportedTokens.keys()].flatMap(account=>indexedByAccount[account] ?? []);
  const nameMatches = (indexedByName[normalize(row.name)] ?? []).filter(token=>!row.reportedTokens.has(token.accountId));
  const deploymentMatches = [...row.reportedContracts].flatMap(account => {
    const deployment = deploymentRows.get(account);
    return deployment ? [{account, signers:deployment[3], previousSigners:deployment[2], repeatSigners:deployment[5]}] : [];
  });
  let status;
  if (row.registryId) status = 'verified_registry';
  else if (standaloneMeme.has(row.id)) status = 'excluded_standalone_meme';
  else if (sharedAssets.has(row.id)) status = 'excluded_shared_asset';
  else if (reportedTokens.length || nameMatches.length) status = 'unverified_token_lead';
  else status = 'no_token_found_in_sources';
  return {
    ...row, categories:[...row.categories].sort(), reportedContracts:[...row.reportedContracts].sort(), reportedTokens,
    deploymentMatches, evidence:[...new Map(row.evidence.map(item=>[item.source,item])).values()],
    tokenScreen:{exactMatches,nameMatches,review:reviewedLeads[row.id] ?? null}, status,
  };
}).sort((a,b)=>a.name.localeCompare(b.name));
const linkedAccounts = new Set(projects.flatMap(project=>project.reportedTokens.map(token=>token.accountId)));
const snapshot = {
  collectedAt:new Date().toISOString(),sources:[explorer,archive,protocols,tokenIndex],deploymentCutoff:deploymentSnapshot.end,projects,
  indexedTokens:indexedTokens.map(token=>({...token,status:rankedAssetAccounts.has(token.accountId) ? 'verified_registry'
    : linkedAccounts.has(token.accountId) ? 'reported_by_catalog' : 'no_exact_catalog_attribution'})),
};
const target = new URL('../data/ecosystem-catalog.json',import.meta.url);
const temporary = new URL(target.href+'.tmp');
await writeFile(temporary,JSON.stringify(snapshot)+'\n');
await rename(temporary,target);
console.log(JSON.stringify(Object.fromEntries(Object.entries(Object.groupBy(projects,row=>row.status)).map(([status,rows])=>[status,rows.length]))));
