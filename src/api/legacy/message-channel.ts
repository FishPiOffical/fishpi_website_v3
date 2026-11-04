import {getLegacyKey} from './auth'
import {legacyPeerName} from './messages'
import type {MessagePeer} from '../v3-messages'
export type LegacyConnection='connecting'|'connected'|'disconnected'
/** One instance is owned by the shared messages store, never one per mounted panel. */
export function createLegacyMessageChannel(peer:MessagePeer,onState:(value:LegacyConnection)=>void,onFrame:(value:unknown)=>void){
 const key=getLegacyKey();legacyPeerName(peer.userName)
 let ws:WebSocket|null=null,retry:ReturnType<typeof setTimeout>|null=null,heartbeat:ReturnType<typeof setInterval>|null=null,attempt=0,disposed=false,generation=0
 const active=()=>!disposed&&!!key&&getLegacyKey()===key
 function stopSocket(){generation++;if(heartbeat)clearInterval(heartbeat);heartbeat=null;const old=ws;ws=null;if(old){old.onopen=old.onmessage=old.onclose=old.onerror=null;old.close()}}
 function schedule(){if(!active()||retry)return;stopSocket();onState('disconnected');retry=setTimeout(()=>{retry=null;connect()},Math.min(30000,1000*2**Math.min(attempt++,5)))}
 function connect(){if(!active()||import.meta.env.SSR)return;stopSocket();const run=generation;onState('connecting')
  try{ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/chat-channel?${new URLSearchParams({apiKey:key!,toUser:peer.userName})}`)}catch{schedule();return}
  const socket=ws,valid=()=>active()&&run===generation&&socket===ws
  socket.onopen=()=>{if(!valid())return;attempt=0;onState('connected');heartbeat=setInterval(()=>{if(valid()&&socket.readyState===WebSocket.OPEN)socket.send('p')},25000)}
  socket.onmessage=event=>{if(!valid()||typeof event.data!=='string'||event.data.length>524288)return;try{const frame=JSON.parse(event.data);if(frame&&typeof frame==='object'&&!Array.isArray(frame))onFrame(frame)}catch{/* never use malformed socket content */}}
  socket.onclose=schedule;socket.onerror=schedule
 }
 connect()
 return{send(content:string){if(!active()||!ws||ws.readyState!==WebSocket.OPEN)return false;ws.send(content);return true},close(){disposed=true;if(retry)clearTimeout(retry);retry=null;stopSocket();onState('disconnected')}}
}
