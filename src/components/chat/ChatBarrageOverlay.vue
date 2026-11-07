<script setup lang="ts">
import {onBeforeUnmount,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatTimelineStore} from '@/stores/v3ChatTimeline'
import type {ChatBarrageEvent} from '@/api/v3-realtime'
const timeline=useV3ChatTimelineStore(),auth=useAuthStore(),rows=ref<Array<ChatBarrageEvent & {lane:number}>>([]),seen=new Map<string,number>(),timers=new Map<string,ReturnType<typeof setTimeout>>()
function remove(id:string){rows.value=rows.value.filter(row=>row.id!==id);const timer=timers.get(id);if(timer)clearTimeout(timer);timers.delete(id)}
function clear(){for(const timer of timers.values())clearTimeout(timer);timers.clear();rows.value=[]}
watch(()=>timeline.barrage,event=>{
 if(!event||!timeline.connected||!auth.accessToken)return
 const now=Date.now();for(const[id,time]of seen)if(now-time>120000)seen.delete(id)
 if(seen.has(event.id))return;seen.set(event.id,now);if(seen.size>200)seen.delete(seen.keys().next().value!)
 if(rows.value.length>=5)remove(rows.value[0]!.id)
 const lane=Array.from({length:5},(_,i)=>i).find(i=>!rows.value.some(row=>row.lane===i))!
 rows.value=[...rows.value,{...event,lane}];timers.set(event.id,setTimeout(()=>remove(event.id),8500))
},{flush:'sync'})
watch(()=>timeline.connected,value=>{if(!value)clear()},{flush:'sync'})
watch(()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||'']),()=>{clear();seen.clear()},{flush:'sync'})
onBeforeUnmount(()=>{clear();seen.clear()})
</script>
<template><div class="chat-barrages" aria-label="聊天室实时弹幕"><p v-for="row in rows" :key="row.id" :style="{color:row.color,top:`${row.lane*40}px`}" class="barrage" @animationend="remove(row.id)"><span>{{ row.author.userNickname||row.author.userName }}：</span>{{ row.content }}</p></div></template>
<style scoped>
.chat-barrages{position:fixed;top:calc(var(--fp-nav-h,80px) + 16px);left:0;right:0;height:208px;overflow:hidden;z-index:1100;pointer-events:none}
.barrage{position:absolute;left:0;width:max-content;max-width:none;white-space:nowrap;margin:0;padding:6px 12px;border-radius:7px;background:rgba(0,0,0,.76);font-size:18px;line-height:1.4;transform:translateX(100vw);animation:barrage-travel 8s linear forwards;will-change:transform;text-shadow:0 1px 2px rgba(0,0,0,.4)}
.barrage span{font-size:13px;margin-right:4px}
@keyframes barrage-travel{from{transform:translateX(100vw)}to{transform:translateX(-100%)}}
@media(max-width:640px){.barrage{font-size:16px}.barrage span{font-size:12px}}
</style>
