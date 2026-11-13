import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {verifyWalletMessage} from '../services/wallet-signature.mjs';

const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes) {
  let n=BigInt('0x'+bytes.toString('hex'));
  let result='';
  while(n) {
    result=alphabet[Number(n%58n)]+result;
    n/=58n;
  }
  for (const byte of bytes) {
    if (byte!==0) break;
    result='1'+result;
  }
  return result;
}

test('NEP-413 verifies a signature for the exact challenge and a full-access key',async t=>{
  const nonce=Buffer.from(Array.from({length:32},(_,i)=>i));
  const challenge={message:'hi',nonce,recipient:'myapp.com',callbackUrl:'myapp.com/callback'};
  // NEP-413 example encoded as tag, string, fixed nonce, recipient, and Some(callback).
  const encoded=Buffer.concat([
    Buffer.from('9d010080020000006869','hex'),nonce,Buffer.from('09000000','hex'),Buffer.from('myapp.com'),
    Buffer.from('0112000000','hex'),Buffer.from('myapp.com/callback'),
  ]);
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const publicBytes=publicKey.export({type:'spki',format:'der'}).subarray(-32);
  const signed={accountId:'example.near',publicKey:'ed25519:'+base58(publicBytes),
    signature:sign(null,createHash('sha256').update(encoded).digest(),privateKey).toString('base64')};
  const lookup=t.mock.method(globalThis,'fetch',async (_url,options)=>{
    const {params}=JSON.parse(options.body);
    assert.equal(params.account_id,signed.accountId);
    assert.equal(params.public_key,signed.publicKey);
    return Response.json({result:{permission:'FullAccess'}});
  });
  assert.equal(await verifyWalletMessage(signed,challenge),true);
  assert.equal(await verifyWalletMessage(signed,{...challenge,recipient:'other.example'}),false);
  assert.equal(await verifyWalletMessage(signed,{...challenge,nonce:Buffer.alloc(32)}),false);
  assert.equal(await verifyWalletMessage(signed,{...challenge,callbackUrl:'myapp.com/other'}),false);
  assert.equal(lookup.mock.callCount(),1);
  const noCallback={message:challenge.message,nonce,recipient:challenge.recipient};
  const connectorPayload=Buffer.concat([encoded.subarray(0,-23),Buffer.of(0)]);
  const connectorSigned={...signed,signature:sign(null,createHash('sha256').update(connectorPayload).digest(),privateKey).toString('base64')};
  assert.equal(await verifyWalletMessage(connectorSigned,noCallback),true);
  assert.equal(await verifyWalletMessage(signed,noCallback),false);
  lookup.mock.mockImplementation(async ()=>Response.json({result:{permission:{FunctionCall:{}}}}));
  assert.equal(await verifyWalletMessage(signed,challenge),false);
});
