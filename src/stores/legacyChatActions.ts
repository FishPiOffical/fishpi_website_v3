import {defineStore} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {legacyChatId,legacyTopicInput,legacyChatRevoke,legacyChatSetTopic} from '@/api/legacy/chat'
import {legacyChatSendMedia} from '@/api/legacy/chat-media'
import {musicInput,type ChatMusicInput} from '@/api/v3-chat-music'
import {weatherInput,type ChatWeatherInput} from '@/api/v3-chat-weather'
import {legacyBarrageInput,legacyChatSendBarrage,type LegacyBarrageInput} from '@/api/legacy/chat-barrage'
import {legacyPacketInput,legacyCreatePacket,legacyClaimPacket,type LegacyPacketInput,type LegacyPacketType} from '@/api/legacy/chat-red-packets'
import {useAuthStore} from './auth'
import {useChatStore} from './chat'
export type LegacyChatAction={kind:'topic';text:string}|{kind:'revoke';id:string}|{kind:'music';input:ChatMusicInput}|{kind:'weather';input:ChatWeatherInput}|{kind:'barrage';input:LegacyBarrageInput}|{kind:'packetCreate';input:LegacyPacketInput}|{kind:'packetClaim';id:string;type:LegacyPacketType;input:{riskAccepted?:true;gesture?:number}}
export const useLegacyChatActionsStore=defineStore('legacy-chat-actions',()=>{
 const auth=useAuthStore(),chat=useChatStore(),pending=ref<LegacyChatAction|null>(null),completed=ref<LegacyChatAction|null>(null),busy=ref(false),error=ref(''),errorKind=ref<LegacyChatAction['kind']|null>(null)
 let generation=0
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId||'']),active=()=>!import.meta.env.SSR&&getApiMode()==='v1'&&!!auth.apiKey&&!!auth.account?.oId
 function clear(){generation++;pending.value=completed.value=null;busy.value=false;error.value='';errorKind.value=null}
 const stop=watch(identity,clear,{flush:'sync'});onScopeDispose(()=>{stop();clear()})
 async function execute(command:LegacyChatAction){if(!active()||busy.value||pending.value)return false;const run=++generation,reader=identity(),valid=()=>active()&&run===generation&&reader===identity();busy.value=true;error.value='';errorKind.value=command.kind;completed.value=null;let confirmed=false
  try{if(command.kind==='topic')await legacyChatSetTopic(command.text);else if(command.kind==='revoke')await legacyChatRevoke(command.id,auth.account!.oId);else if(command.kind==='barrage')await legacyChatSendBarrage(command.input);else if(command.kind==='packetCreate')await legacyCreatePacket(command.input,{id:auth.account!.oId,userName:auth.account!.userName});else if(command.kind==='packetClaim')await legacyClaimPacket(command.id,command.type,command.input,{id:auth.account!.oId,userName:auth.account!.userName});else await legacyChatSendMedia(command.kind,command.input);if(!valid())return false;completed.value=command;confirmed=true;if(command.kind==='revoke')chat.removeConfirmed(command.id);else if(command.kind==='topic')await chat.refreshOnline();else if(command.kind==='music'||command.kind==='weather'||command.kind==='packetCreate'||command.kind==='packetClaim')await chat.refreshMessages();return true}
  catch(e){if(valid()){error.value=e instanceof Error?e.message:'操作失败';if(confirmed){error.value='操作已确认，但当前内容重读失败，请重新读取';return true}if(!(e instanceof ApiError)||e.code!=='legacy_preflight'&&![401,403,404,422].includes(e.status)){pending.value=command;error.value='操作结果未确认，请先核对当前内容和积分记录；不会自动重发。'}}return false}
  finally{if(valid())busy.value=false}}
 function saveTopic(text:string){if(busy.value||pending.value)return Promise.resolve(false);errorKind.value='topic';completed.value=null;try{return execute({kind:'topic',text:legacyTopicInput(text)})}catch(e){error.value=e instanceof Error?e.message:'话题不合法';return Promise.resolve(false)}}
 function revoke(id:string){if(busy.value||pending.value)return Promise.resolve(false);errorKind.value='revoke';completed.value=null;try{return execute({kind:'revoke',id:legacyChatId(id)})}catch(e){error.value=e instanceof Error?e.message:'消息ID不合法';return Promise.resolve(false)}}
 function sendMusic(input:ChatMusicInput){if(busy.value||pending.value)return Promise.resolve(false);errorKind.value='music';completed.value=null;try{return execute({kind:'music',input:musicInput(input)})}catch(e){error.value=e instanceof Error?e.message:'音乐卡片不合法';return Promise.resolve(false)}}
 function sendWeather(input:ChatWeatherInput){if(busy.value||pending.value)return Promise.resolve(false);errorKind.value='weather';completed.value=null;try{return execute({kind:'weather',input:weatherInput(input)})}catch(e){error.value=e instanceof Error?e.message:'天气卡片不合法';return Promise.resolve(false)}}
 function sendBarrage(content:string,color:string){if(busy.value||pending.value)return Promise.resolve(false);errorKind.value='barrage';completed.value=null;try{return execute({kind:'barrage',input:legacyBarrageInput(content,color)})}catch(e){error.value=e instanceof Error?e.message:'弹幕不合法';return Promise.resolve(false)}}
 function createPacket(input:LegacyPacketInput){if(busy.value||pending.value)return Promise.resolve(false);errorKind.value='packetCreate';completed.value=null;try{return execute({kind:'packetCreate',input:legacyPacketInput(input,auth.account?.userName||'')})}catch(e){error.value=e instanceof Error?e.message:'红包参数不合法';return Promise.resolve(false)}}
 function claimPacket(id:string,type:LegacyPacketType,input:{riskAccepted?:true;gesture?:number}){return execute({kind:'packetClaim',id,type,input:{...input}})}
 function release(){if(!busy.value){pending.value=null;error.value='';errorKind.value=null}}
 return{pending,completed,busy,error,errorKind,saveTopic,revoke,sendMusic,sendWeather,sendBarrage,createPacket,claimPacket,release}
})
