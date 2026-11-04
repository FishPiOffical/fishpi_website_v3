<script setup lang="ts">
import {onBeforeUnmount,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useChatStore} from '@/stores/chat'
import type {LegacyBarrageEvent} from '@/api/legacy/chat-barrage'
const chat=useChatStore(),auth=useAuthStore(),rows=ref<(LegacyBarrageEvent&{displayKey:number})[]>([]),timers=new Map<number,ReturnType<typeof setTimeout>>()
let displaySequence=0
function remove(key:number){rows.value=rows.value.filter(r=>r.displayKey!==key);const t=timers.get(key);if(t)clearTimeout(t);timers.delete(key)}
function clear(){for(const t of timers.values())clearTimeout(t);timers.clear();rows.value=[]}
watch(()=>chat.barrage,event=>{if(!event||!chat.connected||!auth.apiKey||!auth.account?.oId)return;if(rows.value.length>=5)remove(rows.value[0]!.displayKey);const key=++displaySequence;rows.value=[...rows.value,{...event,displayKey:key}];timers.set(key,setTimeout(()=>remove(key),8000))},{flush:'sync'})
watch(()=>chat.connected,value=>{if(!value)clear()},{flush:'sync'})
watch(()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId||'']),clear,{flush:'sync'})
onBeforeUnmount(clear)
</script>
<template><div class="chat-barrages" aria-label="聊天室实时弹幕"><p v-for="row in rows" :key="row.displayKey" :style="{color:row.color}" class="barrage"><span>{{ row.author.userNickname||row.author.userName }}：</span>{{ row.content }}</p></div></template>
<style scoped lang="scss">.chat-barrages{position:fixed;top:100px;right:12px;left:12px;z-index:1100;pointer-events:none;display:flex;flex-direction:column;align-items:flex-end;gap:8px}.barrage{max-width:calc(100vw - 32px);overflow-wrap:anywhere;margin:0;padding:6px 12px;border-radius:6px;background:rgba(0,0,0,.8);font-size:18px;animation:barrage-enter .4s ease-out}span{font-size:13px}@keyframes barrage-enter{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}@media(prefers-reduced-motion:reduce){.barrage{animation:none}}</style>
