<script setup lang="ts">
import {onBeforeUnmount,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatTimelineStore} from '@/stores/v3ChatTimeline'
import type {ChatBarrageEvent} from '@/api/v3-realtime'
const timeline=useV3ChatTimelineStore(),auth=useAuthStore(),rows=ref<ChatBarrageEvent[]>([]),seen=new Map<string,number>(),timers=new Map<string,ReturnType<typeof setTimeout>>()
function remove(id:string){rows.value=rows.value.filter(row=>row.id!==id);const timer=timers.get(id);if(timer)clearTimeout(timer);timers.delete(id)}
function clear(){for(const timer of timers.values())clearTimeout(timer);timers.clear();rows.value=[]}
watch(()=>timeline.barrage,event=>{
 if(!event||!timeline.connected||!auth.accessToken)return
 const now=Date.now();for(const[id,time]of seen)if(now-time>120000)seen.delete(id)
 if(seen.has(event.id))return;seen.set(event.id,now);if(seen.size>200)seen.delete(seen.keys().next().value!)
 if(rows.value.length>=5)remove(rows.value[0]!.id)
 rows.value=[...rows.value,event];timers.set(event.id,setTimeout(()=>remove(event.id),8000))
},{flush:'sync'})
watch(()=>timeline.connected,value=>{if(!value)clear()},{flush:'sync'})
watch(()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||'']),()=>{clear();seen.clear()},{flush:'sync'})
onBeforeUnmount(()=>{clear();seen.clear()})
</script>
<template><div class="chat-barrages" aria-label="聊天室实时弹幕"><p v-for="row in rows" :key="row.id" :style="{color:row.color}" class="barrage"><span>{{ row.author.userNickname||row.author.userName }}：</span>{{ row.content }}</p></div></template>
<style scoped lang="scss">.chat-barrages{position:fixed;top:100px;right:12px;left:12px;z-index:1100;pointer-events:none;display:flex;flex-direction:column;align-items:flex-end;gap:8px}.barrage{max-width:calc(100vw - 32px);overflow-wrap:anywhere;margin:0;padding:6px 12px;border-radius:6px;background:rgba(0,0,0,.8);font-size:18px;animation:barrage-enter .4s ease-out}span{font-size:13px}@keyframes barrage-enter{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}@media(prefers-reduced-motion:reduce){.barrage{animation:none}}</style>
