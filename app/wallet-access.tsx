'use client';

import {useEffect,useId,useRef,useState} from 'react';
import Link from 'next/link';
import type {NearConnector,SignedMessage} from '@hot-labs/near-connect';
import {BrandMotion,LoadingPanel} from './brand-motion';
import Icon from './interface-icon';
import Workspace from './workspace-shell';

type Profile={accountId:string;createdAt:string};
type Challenge={nonce:string;message:string;recipient:string};
let connector:Promise<NearConnector>|undefined;

function getConnector() {
  connector ??= import('@hot-labs/near-connect').then(({NearConnector})=>new NearConnector({
    network:'mainnet',
    autoConnect:false,
    features:{mainnet:true,signInAndSignMessage:true},
  })).catch(error=>{connector=undefined;throw error;});
  return connector;
}

async function walletRequest<T>(action:string,body?:object,signal?:AbortSignal):Promise<T> {
  const response=await fetch('/api/wallet?action='+action,{
    method:body ? 'POST' : 'GET', cache:'no-store', signal,
    ...(body ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {}),
  });
  const result=response.status===204 ? undefined : await response.json();
  if (!response.ok) throw new Error(result?.error ?? 'Wallet sign-in is unavailable.');
  return result;
}

async function requestSignature(wallet:NearConnector,{nonce,message,recipient}:Challenge) {
  let signed:SignedMessage|undefined;
  const receive=(event:{accounts:{signedMessage:SignedMessage}[]})=>{
    signed=event.accounts[0]?.signedMessage;
  };
  wallet.on('wallet:signInAndSignMessage',receive);
  try {
    const selected=await wallet.connect({signMessageParams:{message,recipient,nonce:Uint8Array.from(atob(nonce),byte=>byte.charCodeAt(0))}});
    if (!signed) throw new Error('The wallet did not return a signature. Try again.');
    return {signed,name:selected.manifest.name};
  } finally {
    wallet.off('wallet:signInAndSignMessage',receive);
  }
}

export default function WalletAccess({children}:{children:React.ReactNode}) {
  const [profile,setProfile]=useState<Profile|null>();
  const [error,setError]=useState('');
  const [pending,setPending]=useState(false);
  const [verifying,setVerifying]=useState(false);
  const active=useRef<AbortController|null>(null);
  const [walletName,setWalletName]=useState('');
  const [open,setOpen]=useState(false);
  const [copied,setCopied]=useState(false);
  const menu=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const menuId=useId();
  useEffect(()=>{
    if (!open) return;
    function dismiss(event:Event) {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown',dismiss);
    document.addEventListener('focusin',dismiss);
    return ()=>{
      document.removeEventListener('pointerdown',dismiss);
      document.removeEventListener('focusin',dismiss);
    };
  },[open]);
  useEffect(()=>{
    const controller=new AbortController();
    walletRequest<{profile:Profile|null}>('session',undefined,AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])).then(result=>{
      if (!controller.signal.aborted) {
        setProfile(result.profile);
        if (result.profile) {
          try {setWalletName(localStorage.getItem('iv-wallet:'+result.profile.accountId) ?? '');} catch {}
        }
      }
    }).catch(()=>{
      if (!controller.signal.aborted) {setProfile(null);setError('Could not check your session. Try signing in again.');}
    });
    return ()=>{controller.abort();active.current?.abort();};
  },[]);

  async function signIn() {
    if (active.current) return;
    const controller=new AbortController();
    active.current=controller;
    setPending(true);
    setError('');
    try {
      const [wallet,challenge]=await Promise.all([getConnector(),walletRequest<Challenge>('challenge',{},controller.signal)]);
      await wallet.whenManifestLoaded;
      if (controller.signal.aborted) return;
      if (!wallet.availableWallets.length) throw new Error('Could not load NEAR wallets. Check your connection and try again.');
      const {signed,name}=await requestSignature(wallet,challenge);
      if (controller.signal.aborted) return;
      setVerifying(true);
      const result=await walletRequest<{profile:Profile}>('verify',signed,controller.signal);
      setProfile(result.profile);
      setWalletName(name);
      setOpen(false);
      try {localStorage.setItem('iv-wallet:'+result.profile.accountId,name);} catch {}
    } catch (cause) {
      if (!controller.signal.aborted && !(cause instanceof Error && cause.message==='User rejected')) {
        setError(cause instanceof Error ? cause.message : 'Wallet sign-in failed. Try again.');
      }
    } finally {
      if (active.current===controller) {active.current=null;setPending(false);setVerifying(false);}
    }
  }

  async function signOut() {
    setError('');
    setPending(true);
    try {
      await walletRequest('logout',{});
      void getConnector().then(wallet=>wallet.disconnect()).catch(()=>{});
      setOpen(false);
      setWalletName('');
      setProfile(null);
    } catch {setError('Could not sign out. Try again.');}
    finally {setPending(false);}
  }

  if (!profile) return <Workspace><main id="main-content" className="iv-auth-main">
    {profile===undefined ? <LoadingPanel title="Checking Your Session" description="Preparing your Invisible workspace."/> : <section className="iv-auth-card iv-ready-fade" aria-labelledby="wallet-title">
      <div className="iv-auth-heading">
        <BrandMotion/>
        <h1 id="wallet-title">Sign in to Invisible</h1>
        <p>Use your NEAR wallet to open the dashboard.</p>
      </div>
      <ol className="iv-auth-steps" aria-label="Sign-in progress">
        <li data-complete={verifying} aria-current={verifying ? undefined : 'step'}><span>{verifying ? <Icon name="check"/> : '1'}</span><div><strong>Connect your wallet</strong><p>Choose a wallet and approve the sign-in message.</p></div></li>
        <li aria-current={verifying ? 'step' : undefined}><span>2</span><div><strong>Verify your account</strong><p>Your signature opens the dashboard.</p></div></li>
      </ol>
      <button type="button" className="iv-primary" disabled={pending} onClick={()=>void signIn()}>
        <Icon name="plug"/>{verifying ? 'Verifying your account…' : pending ? 'Continue in your wallet…' : 'Connect NEAR Wallet'}
      </button>
      {pending && <div className="iv-session-track" role="status" aria-label={verifying ? 'Verifying signature' : 'Waiting for wallet'}><i/></div>}
      {error && <p role="alert">{error}</p>}
      <Link href="/docs/">Read the Docs <Icon name="right"/></Link>
    </section>}
  </main></Workspace>;

  const accountId=profile.accountId;
  const shortAccount=accountId.length>22 ? accountId.slice(0,9)+'…'+accountId.slice(-7) : accountId;
  const account=<div className="iv-wallet-menu" ref={menu} onKeyDown={event=>{
    if (event.key==='Escape' && open) {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    }
  }}>
    <button className="iv-wallet-trigger" type="button" ref={trigger} aria-expanded={open} aria-controls={menuId}
      onClick={()=>{setOpen(!open);setCopied(false);setError('');}}>
      <span className="iv-wallet-avatar"><Icon name="account"/></span>
      <span className="iv-wallet-short" title={accountId}>{shortAccount}</span><Icon name="chevron"/>
    </button>
    <div className="iv-wallet-dropdown" id={menuId} hidden={!open}>
      <div className="iv-wallet-identity"><span>{walletName || 'NEAR Wallet'}</span><strong>{accountId}</strong></div>
      <button type="button" onClick={async()=>{
        try {await navigator.clipboard.writeText(accountId);setCopied(true);}
        catch {setError('Clipboard unavailable. You can select the address above.');}
      }}><Icon name={copied ? 'check' : 'copy'}/>{copied ? 'Address Copied' : 'Copy Address'}</button>
      <a href={'https://nearblocks.io/address/'+encodeURIComponent(accountId)} target="_blank" rel="noopener noreferrer"><Icon name="launch"/> View on NearBlocks</a>
      <button type="button" disabled={pending} onClick={()=>void signOut()}><Icon name="disconnect"/>{pending ? 'Disconnecting…' : 'Disconnect'}</button>
      {error && <p role="alert">{error}</p>}
    </div>
  </div>;
  return <Workspace account={account}>{children}</Workspace>;
}
