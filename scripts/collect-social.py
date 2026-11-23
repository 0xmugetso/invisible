#!/usr/bin/env python3
"""Read official public channels, store source evidence, then run the versioned scorer."""
import argparse
import datetime as dt
import hashlib
import html
import json
import os
from pathlib import Path
import re
import subprocess
import shutil
import sys
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NOW = dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00','Z')
parser = argparse.ArgumentParser()
parser.add_argument('--discover', action='store_true', help='Discover candidate links for a separate attribution review')
parser.add_argument('--project', help='Collect one mapped project ID')
parser.add_argument('--agent-reach', default=os.environ.get('AGENT_REACH_BIN',str(ROOT/'.local/agent-reach-venv/bin/agent-reach') if (ROOT/'.local/agent-reach-venv/bin/agent-reach').exists() else 'agent-reach'))
parser.add_argument('--only-x', action='store_true', help='Refresh attributed X timelines and retain other channels')
parser.add_argument('--timeout',type=int,default=75,help='Maximum seconds per Agent Reach query')
parser.add_argument('--skip-x', action='store_true', help='Collect public channels while a login is pending')
parser.add_argument('--rediscover', action='store_true', help='Refresh official-page links using saved attribution')
parser.add_argument('--output', default=str(ROOT/'data/social-evidence.json'))
args = parser.parse_args()
if not 10<=args.timeout<=180: parser.error('--timeout must be between 10 and 180 seconds')
if args.only_x and args.skip_x: parser.error('--only-x and --skip-x are mutually exclusive')
if not shutil.which(args.agent_reach):
    parser.error('Install Agent Reach from its official GitHub release or provide --agent-reach PATH')
try:
    version_result=subprocess.run([args.agent_reach,'version'],capture_output=True,text=True,timeout=10,check=True)
    collector_version=json.loads(version_result.stdout)['result']['version']
except (subprocess.SubprocessError,KeyError,json.JSONDecodeError):
    parser.error('Agent Reach must support the versioned JSON command interface')

registry = json.loads((ROOT/'data/activity-registry.json').read_text())
catalog = json.loads((ROOT/'data/ecosystem-catalog.json').read_text())
memes = {p.get('registryId',p['id']) for p in catalog['projects'] if 'memecoin' in p['categories']}
projects = [p for p in registry if p['id'] not in memes and not p.get('benchmark')]
if args.project:
    projects = [p for p in projects if p['id']==args.project]
    if not projects:
        parser.error('Unknown or excluded project')
output = Path(args.output)
existing = json.loads(output.read_text()) if output.exists() else {'schemaVersion':1,'projects':[]}
if args.discover and Path(args.output)==ROOT/'data/social-evidence.json':
    parser.error('--discover requires --output to keep candidates separate from published evidence')
records = {p['id']:p for p in existing['projects']}
approved=json.loads((ROOT/'data/social-sources.json').read_text()) if (ROOT/'data/social-sources.json').exists() else {}

def reach(channel, action, value, limit=None):
    cmd=[args.agent_reach,channel,action,value,'--timeout',str(args.timeout)]
    if limit: cmd+=['--limit',str(limit)]
    try:
        proc=subprocess.run(cmd,capture_output=True,text=True,timeout=args.timeout+10)
        return json.loads(proc.stdout)
    except (subprocess.TimeoutExpired,FileNotFoundError,json.JSONDecodeError):
        return {'ok':False,'error':{'code':'COLLECTOR_UNAVAILABLE'},'items':[]}

def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'InvisibleResearch/1.0 (+https://invisible-gray.vercel.app/docs/)'})
    with urllib.request.urlopen(req,timeout=12) as res:
        return res.read(2000000).decode('utf-8','replace')

def iso(value):
    if not value: return None
    if isinstance(value,(int,float)):
        return dt.datetime.fromtimestamp(value/(1000 if value>1e12 else 1),dt.timezone.utc).isoformat()
    try:
        parsed=dt.datetime.fromisoformat(str(value).replace('Z','+00:00'))
        if parsed.tzinfo is None: parsed=parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc).isoformat()
    except ValueError:
        import email.utils
        try: return email.utils.parsedate_to_datetime(value).isoformat()
        except (ValueError,TypeError): return None

def clean(text):
    return html.unescape(re.sub('<[^>]+>',' ',text or '')).strip()

def source(platform,url,evidence):
    return {'platform':platform,'url':url,'attributionSource':evidence,'checkedAt':NOW,
            'status':'unavailable','error':None,'posts':[],'sampleComplete':False}

def save():
    payload={'schemaVersion':1,'updatedAt':NOW,
        'projects':sorted(records.values(),key=lambda p:p['name'])}
    output.parent.mkdir(parents=True,exist_ok=True)
    temp=output.with_suffix('.tmp')
    temp.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
    temp.replace(output)

for p in projects:
    if args.only_x and not any(s['platform']=='X' for s in approved.get(p['id'],[])): continue
    links={}
    for label,value in p.get('links',{}).items():
        url=value if isinstance(value,str) else value['url']
        links[url]=url if isinstance(value,str) else value.get('evidence',url)
    website=p.get('links',{}).get('website')
    if isinstance(website,dict): website=website['url']
    for old in records.get(p['id'],{}).get('sources',[]):
        links[old['url']]=old['attributionSource']
    discovery=records.get(p['id'],{}).get('discovery',{'status':'not_available','url':website})
    if (args.discover or args.rediscover) and website and 'nearblocks.io' not in website:
        page=reach('web','read',website) if not args.rediscover else {'ok':True,'items':[]}
        try:
            direct=get(website)
        except Exception:
            direct=''

        discovery={'status':'collected' if page.get('ok') else 'unavailable','url':website,
                   'error':(page.get('error') or {}).get('code'),'checkedAt':NOW}
        text='\n'.join(i.get('text') or '' for i in page.get('items',[]))+'\n'+html.unescape(direct).replace('\\/','/')

        for url in re.findall(r'https?://[^\s<>"\)\]]+',text):
            if re.search(r'(?:x\.com|twitter\.com|t\.me|discord\.gg|discord\.com|medium\.com|github\.com|youtube\.com)',url):
                links[url]=website
    if not args.discover:
        links={s['url']:s['attributionSource'] for s in approved.get(p['id'],[])}
    channels=[]
    used=set()
    for url,evidence in links.items():
        try:
            parsed=urllib.parse.urlparse(url)
            host=parsed.netloc.lower().removeprefix('www.')
            parts=parsed.path.strip('/').split('/')
            key=None
            if host in ('twitter.com','x.com') and re.fullmatch(r'[A-Za-z0-9_]{1,15}',parts[0]) and parts[0] not in ('share','intent','i','home','search'):
                key=('X',parts[0].lower())
            elif host=='t.me' and re.fullmatch(r'[A-Za-z0-9_]{4,}',parts[0]) and parts[0]!='share':
                key=('Telegram',parts[0])
            elif host in ('discord.gg','discord.com'): key=('Discord',parsed.path)
            elif host=='github.com' and len(parts)>=2: key=('GitHub', '/'.join(parts[:2]))
            elif host.endswith('medium.com'): key=('Medium',host+parsed.path)
            elif host=='youtube.com' and (parts[0].startswith('@') or parts[0] in ('channel','c')): key=('YouTube',parts[0])
            if not key or key in used: continue
            if key[0]=='GitHub' and not all(re.fullmatch(r'[A-Za-z0-9_.-]+',part) for part in key[1].split('/')): continue
            used.add(key)
            s=source(key[0],url,evidence)
            if args.only_x and key[0]!='X':
                previous=next((old for old in records.get(p['id'],{}).get('sources',[]) if old['url']==url),None)
                if previous: channels.append(previous)
                continue
            if key[0]=='X':
                if args.skip_x:
                    old=next((old for old in records.get(p['id'],{}).get('sources',[]) if old['url']==url),None)
                    if old: s=old
                    else: s['error']='NEED_LOGIN'
                    channels.append(s)
                    continue
                result=reach('twitter','tweets',key[1],30)
                if result.get('ok'):
                    for item in result.get('items',[]):
                        raw=item.get('raw') or {}
                        post_url=item.get('url')
                        if not post_url and raw.get('id'): post_url=f'https://x.com/{key[1]}/status/{raw["id"]}'
                        stamp=iso(item.get('published_at'))
                        post_host=urllib.parse.urlparse(post_url or '').netloc.removeprefix('www.')
                        if post_url and stamp and post_host in ('twitter.com','x.com') and '/status/' in post_url:
                            s['posts'].append({'url':post_url,'publishedAt':stamp,'text':(item.get('text') or '')[:1200],
                                               'kind':'repost' if raw.get('is_retweet') or (item.get('author') or key[1]).lower().lstrip('@')!=key[1] else 'post',
                                               'author':item.get('author'),
                                               'metrics':{k:raw[upstream] for k,upstream in [('likes','likes'),('replies','replies'),('reposts','retweets'),('views','views')] if isinstance(raw.get(upstream),(int,float))}})
                    s['status']='collected'; s['sampleComplete']=len(s['posts'])>=30
                else: s['error']=(result.get('error') or {}).get('code','UPSTREAM_UNAVAILABLE')
            elif key[0]=='Telegram':
                # Public channel previews expose timestamps and permalinks. Groups may expose none.
                before=None
                known=set()
                for _ in range(3):
                    page=get('https://t.me/s/'+key[1]+('?before='+str(before) if before else ''))
                    ids=[]
                    for match in re.finditer(r'data-post="([^"]+)"(.*?)(?=data-post="|\Z)',page,re.S):
                        body=match[2]; stamp=re.search(r'<time[^>]+datetime="([^"]+)"',body)
                        text=re.search(r'class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>',body,re.S)
                        if match[1].split('/')[-1].isdigit(): ids.append(int(match[1].split('/')[-1]))
                        if stamp and text and match[1] not in known:
                            known.add(match[1])
                            s['posts'].append({'url':'https://t.me/'+match[1],'publishedAt':iso(stamp[1]),'text':clean(text[1])[:1200],'metrics':{}})
                    if len(s['posts'])>=30 or not ids or min(ids)==before: break
                    before=min(ids)
                s['posts']=sorted(s['posts'],key=lambda post:post['publishedAt'],reverse=True)[:30]
                s['sampleComplete']=len(s['posts'])>=30
                s['status']='collected' if s['posts'] else 'unavailable'
                if not s['posts']: s['error']='PUBLIC_HISTORY_UNAVAILABLE'
            elif key[0]=='Medium':
                feed='https://'+host+'/feed'+parsed.path.rstrip('/')
                root=ET.fromstring(get(feed))
                for item in root.findall('.//item')[:30]:
                    s['posts'].append({'url':item.findtext('link'),'publishedAt':iso(item.findtext('pubDate')),
                                      'text':clean(item.findtext('title')),'metrics':{}})
                s['status']='collected'
            elif key[0]=='GitHub':
                result=reach('github','read',key[1])
                s['profileStatus']='collected' if result.get('ok') else 'unavailable'
                root=ET.fromstring(get('https://github.com/'+key[1]+'/releases.atom'))
                ns={'a':'http://www.w3.org/2005/Atom'}
                for item in root.findall('a:entry',ns)[:30]:
                    link=item.find('a:link',ns)
                    s['posts'].append({'url':link.get('href'),'publishedAt':iso(item.findtext('a:updated',namespaces=ns)),
                                      'text':clean(item.findtext('a:title',namespaces=ns)),'metrics':{}})
                s['status']='collected'
            else:
                s['error']='HISTORY_ADAPTER_PENDING'
            channels.append(s)
        except Exception as error:
            if 's' in locals():
                s['error']='PUBLIC_FETCH_FAILED';channels.append(s)
    for channel in channels:
        previous=next((old for old in records.get(p['id'],{}).get('sources',[]) if old['url']==channel['url']),None)
        if not channel['posts'] and previous and previous['posts']:
            channel['lastAttempt']={'checkedAt':NOW,'error':channel['error'],'status':channel['status']}
            channel['error']=None
            channel.update({key:previous[key] for key in ['checkedAt','status','posts','sampleComplete']})
    records[p['id']]={'id':p['id'],'name':p['name'],'tokenVerified':bool(p['tokens']),
                      'observedAt':NOW,'discovery':discovery,'sources':channels}
    save()
    print(p['id'], ', '.join(f'{s["platform"]}:{len(s["posts"])}:{s["error"] or "ok"}' for s in channels) or 'no attributed social history',flush=True)
