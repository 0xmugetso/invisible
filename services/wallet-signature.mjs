import {createHash, createPublicKey, verify} from 'node:crypto';

const base58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function decodeKey(value) {
  let number=0n;
  for (const character of value) {
    const digit=base58.indexOf(character);
    if (digit<0) return null;
    number=number*58n+BigInt(digit);
  }
  const hexadecimal=number.toString(16);
  const bytes=number ? Buffer.from(hexadecimal.padStart(Math.ceil(hexadecimal.length/2)*2,'0'),'hex') : Buffer.alloc(0);
  return Buffer.concat([Buffer.alloc(value.match(/^1*/)[0].length),bytes]);
}

function borshString(value) {
  const bytes=Buffer.from(value,'utf8');
  const length=Buffer.alloc(4);
  length.writeUInt32LE(bytes.length);
  return Buffer.concat([length,bytes]);
}

export function walletMessageHash({message,nonce,recipient,callbackUrl}) {
  const tag=Buffer.alloc(4);
  tag.writeUInt32LE(2**31+413);
  const callback=callbackUrl ? Buffer.concat([Buffer.of(1),borshString(callbackUrl)]) : Buffer.of(0);
  return createHash('sha256').update(Buffer.concat([tag,borshString(message),nonce,borshString(recipient),callback])).digest();
}

export async function verifyWalletMessage({accountId,publicKey,signature},challenge) {
  if (typeof accountId!=='string' || accountId.length<2 || accountId.length>64 ||
      !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(accountId) ||
      typeof publicKey!=='string' || !/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(publicKey) ||
      typeof signature!=='string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return false;
  const bytes=decodeKey(publicKey.slice(8));
  if (bytes?.length!==32) return false;
  const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),bytes]),format:'der',type:'spki'});
  if (!verify(null,walletMessageHash(challenge),key,Buffer.from(signature,'base64'))) return false;
  const response=await fetch(process.env.NEAR_RPC_URL || 'https://rpc.mainnet.near.org',{
    method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(6000),
    body:JSON.stringify({jsonrpc:'2.0',id:'wallet-access-key',method:'query',params:{
      request_type:'view_access_key',finality:'final',account_id:accountId,public_key:publicKey,
    }}),
  });
  if (!response.ok) throw new Error('NEAR access key lookup failed');
  const {result,error}=await response.json();
  if (error && error.cause?.name!=='UNKNOWN_ACCESS_KEY' && error.cause?.name!=='UNKNOWN_ACCOUNT') throw new Error('NEAR access key lookup failed');
  return result?.permission==='FullAccess';
}
