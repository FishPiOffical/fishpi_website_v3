import {ApiError} from '../http'
import {getLegacyKey} from './auth'
import {legacyChatNode} from './chat'
/** Only the trusted HTTP allocator chooses a node. Its ephemeral key stays in this closure. */
export function createLegacyChatChannel(preferred:string,events:{state:(state:'connecting'|'ready'|'closed')=>void;node:(name:string,options:import('../fishpi').ChatNodeOption[])=>void;frame:(frame:Record<string,unknown>)=>void;error:(message:string)=>void}){
 const key=getLegacyKey();let disposed=false,generation=0,ws:WebSocket|null=null,abort:AbortController|null=null,retry:ReturnType<typeof setTimeout>|null=null,heartbeat:ReturnType<typeof setInterval>|null=null,attempt=0
 const active=()=>!disposed&&!!key&&key===getLegacyKey()
 function stop(){generation++;abort?.abort();abort=null;if(heartbeat)clearInterval(heartbeat);heartbeat=null;const old=ws;ws=null;if(old){old.onopen=old.onmessage=old.onclose=old.onerror=null;old.close()}}
 function schedule(){if(!active()||retry)return;stop();events.state('closed');retry=setTimeout(()=>{retry=null;void connect()},Math.min(30000,1000*2**Math.min(attempt++,5)))}
 async function connect(){if(!active()||import.meta.env.SSR)return;stop();events.state('connecting');const run=generation,controller=new AbortController();abort=controller;const valid=()=>active()&&run===generation&&!controller.signal.aborted
  try{const node=await legacyChatNode(preferred,controller.signal);if(!valid())return;events.node(node.name,node.options);let socket:WebSocket;try{socket=new WebSocket(node.url)}catch{events.error('聊天室节点连接失败');schedule();return}ws=socket
   socket.onopen=()=>{if(!valid()||ws!==socket)return;attempt=0;events.state('ready');heartbeat=setInterval(()=>{if(valid()&&socket.readyState===WebSocket.OPEN)socket.send('-hb-')},180000)}
   socket.onmessage=e=>{if(!valid()||ws!==socket||typeof e.data!=='string'||e.data.length>524288)return;let frame:unknown;try{frame=JSON.parse(e.data)}catch{return}if(frame&&typeof frame==='object'&&!Array.isArray(frame))events.frame(frame as Record<string,unknown>)}
   socket.onclose=schedule;socket.onerror=schedule
  }catch(e){if(valid()){events.error(e instanceof Error?e.message:'聊天室连接失败');if(e instanceof ApiError&&[401,403].includes(e.status)){events.state('closed');stop()}else schedule()}}
 }
 void connect()
 return()=>{disposed=true;if(retry)clearTimeout(retry);retry=null;stop()}
}
