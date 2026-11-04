import {getLegacyKey} from './auth'
// The old protocol requires apiKey in its URL. This module never reads a v3 Bearer.
const listeners=new Set<()=>void>()
let socket:WebSocket|null=null,timer:ReturnType<typeof setTimeout>|null=null,generation=0,boundKey:string|null=null,retries=0
function disconnect(){generation++;if(timer)clearTimeout(timer);timer=null;const old=socket;socket=null;if(old){old.onopen=old.onmessage=old.onclose=old.onerror=null;old.close()}boundKey=null}
function start(){
  if(import.meta.env.SSR||!listeners.size||!getLegacyKey())return
  const key=getLegacyKey()!
  if(socket&&boundKey===key)return
  disconnect();boundKey=key
  const version=generation
  const active=()=>version===generation&&boundKey===key&&getLegacyKey()===key&&listeners.size>0
  const retry=()=>{if(!active()||timer)return;const old=socket;socket=null;if(old){old.onclose=null;old.close()}timer=setTimeout(()=>{timer=null;if(active())start()},Math.min(30000,1000*2**Math.min(retries++,5)))}
  let ws:WebSocket
  try{ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/user-channel?${new URLSearchParams({apiKey:key})}`)}catch{retry();return}
  socket=ws
  ws.onopen=()=>{if(!active()||socket!==ws)return;retries=0;for(const f of listeners)f()}
  ws.onmessage=e=>{if(!active()||socket!==ws||typeof e.data!=='string'||e.data.length>65536)return;try{const data=JSON.parse(e.data);if(!data||typeof data!=='object'||typeof data.command!=='string')return;for(const f of listeners)f()}catch{/* malformed frames never become application content */}}
  ws.onclose=retry;ws.onerror=retry
}
export function subscribeLegacyUserChanges(listener:()=>void) {
  if(import.meta.env.SSR)return()=>{}
  listeners.add(listener);start()
  return()=>{listeners.delete(listener);if(!listeners.size){retries=0;disconnect()}}
}
if(import.meta.hot)import.meta.hot.dispose(()=>{listeners.clear();disconnect()})
