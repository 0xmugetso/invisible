import {BigQuery} from '@google-cloud/bigquery';

import {IdentityPoolClient} from 'google-auth-library';

function createClient(projectId, oidcToken) {
  const {BQ_WIF_PROVIDER:provider, BQ_SERVICE_ACCOUNT_EMAIL:account, BQ_CREDENTIALS_JSON:json} = process.env;
  if (provider || account) {
    if (!/^projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/.test(provider ?? '') ||
        !/^[a-z0-9-]+@[a-z0-9.-]+\.iam\.gserviceaccount\.com$/.test(account ?? '')) {
      throw new Error('Set BQ_WIF_PROVIDER and BQ_SERVICE_ACCOUNT_EMAIL to valid Google Cloud resource identifiers.');
    }
    if (typeof oidcToken !== 'string' || !oidcToken) throw new Error('Vercel did not supply an OIDC token for this invocation.');
    const authClient = new IdentityPoolClient({
      audience:'//iam.googleapis.com/'+provider,
      subject_token_type:'urn:ietf:params:oauth:token-type:jwt',
      token_url:'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url:'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'+account+':generateAccessToken',
      subject_token_supplier:{getSubjectToken:async () => oidcToken},
      scopes:['https://www.googleapis.com/auth/cloud-platform'],
    });
    return new BigQuery({projectId,authClient});
  }
  const credentials = JSON.parse(json ?? 'null');
  if (!credentials?.client_email || !credentials?.private_key) throw new Error('Configure BigQuery workload identity or service account credentials.');
  return new BigQuery({projectId,credentials});
}

export function bigQueryForInvocation(oidcToken) {
  let client;
  return (sql, params, {project, byteCap, maxRows}) => {
    client ??= createClient(project, oidcToken);
    return queryBigQuery(client, sql, params, {byteCap,maxRows});
  };
}

async function queryBigQuery(client, sql, params, {byteCap,maxRows}) {
  const [job] = await client.createQueryJob({
    query:sql, params, types:Object.fromEntries(Object.keys(params).map(key => [key, key === 'day' ? 'DATE' : 'STRING'])),
    location:'us-east1', maximumBytesBilled:byteCap, jobTimeoutMs:120000,
  });
  const [rows, next] = await job.getQueryResults({autoPaginate:false, maxResults:10000, timeoutMs:120000});
  let page = next;
  while (page && rows.length < maxRows) {
    const [batch, following] = await job.getQueryResults({...page, autoPaginate:false, maxResults:10000});
    rows.push(...batch);
    page = following;
  }
  return rows;
}
