import {createHash,randomBytes} from 'node:crypto';
import {appOrigin} from '../services/integration-origin.mjs';
import {openDatabase,transaction} from '../services/store.mjs';
import {verifyWalletMessage} from '../services/wallet-signature.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const nonceCookie='iv_wallet_nonce';
const sessionCookie='iv_wallet_session';

function readCookie(request,name) {
  const value=request.headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith(name+'='))?.slice(name.length+1);
  return /^[a-f0-9]{64}$/.test(value ?? '') ? value : null;
}

function cookie(name,value,age) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${appOrigin().startsWith('https:') ? '; Secure' : ''}`;
}

function challenge(nonce,origin) {
  return {nonce,message:'Sign in to Invisible on NEAR mainnet.',recipient:new URL(origin).host};
}

export default async function handler(request,response) {
  response.setHeader('Cache-Control','no-store');
  const action=request.query.action;
  const method=action==='session' ? 'GET' : 'POST';
  if (request.method!==method) {
    response.setHeader('Allow',method);
    return response.status(405).end();
  }
  const origin=request.headers.origin;
  const allowedOrigin=origin===appOrigin();
  if (method==='POST' && (!allowedOrigin || new URL(origin).host!==request.headers.host)) {
    return response.status(403).json({error:'Unexpected origin'});
  }
  const token=readCookie(request,sessionCookie);
  if (action==='session' && !token) return response.status(200).json({profile:null});
  let db;
  try {
    db=openDatabase();
    if (action==='challenge') {
      const nonce=randomBytes(32);
      await db.query('DELETE FROM invisible.wallet_challenge WHERE expires_at<=now()');
      await db.query("INSERT INTO invisible.wallet_challenge VALUES ($1,now()+interval '5 minutes')",[hash(nonce)]);
      response.setHeader('Set-Cookie',cookie(nonceCookie,nonce.toString('hex'),300));
      return response.status(200).json({...challenge(nonce,origin),nonce:nonce.toString('base64')});
    }
    if (action==='verify') {
      const saved=readCookie(request,nonceCookie);
      const signed=request.body;
      if (!saved || !signed || typeof signed!=='object') return response.status(400).json({error:'Start a new wallet sign-in'});
      const nonce=Buffer.from(saved,'hex');
      const nonceHash=hash(nonce);
      const pending=await db.query('SELECT 1 FROM invisible.wallet_challenge WHERE nonce_hash=$1 AND expires_at>now()',[nonceHash]);
      if (!pending.rowCount) return response.status(409).json({error:'This sign-in request expired or was already used'});
      if (!await verifyWalletMessage(signed,challenge(nonce,origin))) return response.status(401).json({error:'The wallet signature could not be verified'});
      const next=randomBytes(32).toString('hex');
      const profile=await transaction(db,async client=>{
        const consumed=await client.query('DELETE FROM invisible.wallet_challenge WHERE nonce_hash=$1 AND expires_at>now() RETURNING nonce_hash',[nonceHash]);
        if (!consumed.rowCount) return null;
        const {rows:[user]}=await client.query(`INSERT INTO invisible.wallet_user (account_id) VALUES ($1)
          ON CONFLICT (account_id) DO UPDATE SET last_signed_in_at=now() RETURNING account_id AS "accountId",created_at AS "createdAt"`,[signed.accountId]);
        if (token) await client.query('DELETE FROM invisible.wallet_session WHERE token_hash=$1',[hash(token)]);
        await client.query('DELETE FROM invisible.wallet_session WHERE expires_at<=now()');
        await client.query("INSERT INTO invisible.wallet_session VALUES ($1,$2,now()+interval '7 days')",[hash(next),signed.accountId]);
        return user;
      });
      if (!profile) return response.status(409).json({error:'This sign-in request expired or was already used'});
      response.setHeader('Set-Cookie',[cookie(nonceCookie,'',0),cookie(sessionCookie,next,604800)]);
      return response.status(200).json({profile});
    }
    if (action==='session') {
      const {rows:[profile]}=await db.query(`SELECT u.account_id AS "accountId",u.created_at AS "createdAt"
        FROM invisible.wallet_session s JOIN invisible.wallet_user u USING (account_id)
        WHERE s.token_hash=$1 AND s.expires_at>now()`,[hash(token)]);
      return response.status(200).json({profile:profile ?? null});
    }
    if (action==='logout') {
      if (token) await db.query('DELETE FROM invisible.wallet_session WHERE token_hash=$1',[hash(token)]);
      response.setHeader('Set-Cookie',[cookie(nonceCookie,'',0),cookie(sessionCookie,'',0)]);
      return response.status(204).end();
    }
    return response.status(404).end();
  } catch (error) {
    console.error('Wallet authentication failed',error.message);
    return response.status(503).json({error:'Wallet sign-in is temporarily unavailable'});
  } finally {
    await db?.end();
  }
}
