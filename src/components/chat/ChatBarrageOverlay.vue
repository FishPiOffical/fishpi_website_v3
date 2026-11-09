<script setup lang="ts">
import {onBeforeUnmount,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatTimelineStore} from '@/stores/v3ChatTimeline'
import type {ChatBarrageEvent} from '@/api/v3-realtime'
import ChatBarrageBubble from './ChatBarrageBubble.vue'
const laneCount = 5
const timeline=useV3ChatTimelineStore(),auth=useAuthStore(),rows=ref<Array<ChatBarrageEvent & {lane:number;duration:number}>>([]),seen=new Map<string,number>()
function remove(id:string){rows.value=rows.value.filter(row=>row.id!==id)}
function clear(){rows.value=[]}
watch(()=>timeline.barrage,event=>{
 if(!event||!timeline.connected||!auth.accessToken)return
 const now=Date.now();for(const[id,time]of seen)if(now-time>120000)seen.delete(id)
 if(seen.has(event.id))return;seen.set(event.id,now);if(seen.size>200)seen.delete(seen.keys().next().value!)
 if(rows.value.length>=laneCount)remove(rows.value[0]!.id)
 const freeLanes=Array.from({length:laneCount},(_,i)=>i).filter(i=>!rows.value.some(row=>row.lane===i))
 const lane=freeLanes[Math.floor(Math.random()*freeLanes.length)]!
 rows.value=[...rows.value,{...event,lane,duration:10+Math.random()*10}]
},{flush:'sync'})
watch(()=>timeline.connected,value=>{if(!value)clear()},{flush:'sync'})
watch(()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||'']),()=>{clear();seen.clear()},{flush:'sync'})
onBeforeUnmount(()=>{clear();seen.clear()})
</script>
<template>
  <div class="chat-barrages" aria-label="聊天室实时弹幕">
    <div
      v-for="row in rows"
      :key="row.id"
      class="barrage"
      :style="{ top: `${row.lane * 20}%`, animationDuration: `${row.duration}s` }"
      @animationend="remove(row.id)"
    >
      <ChatBarrageBubble
        :avatar="row.author.userAvatarURL"
        :author="row.author.userNickname || row.author.userName"
        :color="row.color"
        :content="row.content"
      />
    </div>
  </div>
</template>

<style scoped>
.chat-barrages {
  position: fixed;
  top: calc(var(--fp-nav-h, 80px) + 16px);
  inset-inline: 0;
  height: clamp(185px, 42vh, 340px);
  overflow: hidden;
  z-index: 1100;
  pointer-events: none;
}
.barrage {
  position: absolute;
  left: 0;
  width: max-content;
  white-space: nowrap;
  pointer-events: auto;
  animation: barrage-travel linear both;
}
@media (hover: hover) {
  .barrage:hover { animation-play-state: paused; }
}
@keyframes barrage-travel {
  from { transform: translateX(100vw); }
  to { transform: translateX(-100%); }
}
</style>
