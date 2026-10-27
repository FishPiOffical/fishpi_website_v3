<script setup lang="ts">
import {nextTick,watch} from 'vue'
import {storeToRefs} from 'pinia'
import FpDialog from '@/components/FpDialog.vue'
import {getAuthContextVersion} from '@/api/http'
import {useChatContext} from '@/composables/useChatContext'
import {useAuthStore} from '@/stores/auth'
const props=defineProps<{messageId:string}>(),emit=defineEmits<{close:[];latest:[]}>(),context=useChatContext(),{accessToken,account}=storeToRefs(useAuthStore())
watch(()=>props.messageId,id=>{if(id&&accessToken.value&&account.value?.oId)void context.open(id);else context.close()},{immediate:true})
watch(()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||'']),(next,previous)=>{const old=JSON.parse(previous) as [number,boolean,string];if(old[1]&&old[2]&&next!==previous)emit('close')})
watch(()=>context.list.value,async()=>{await nextTick();if(typeof document==='undefined')return;document.getElementById('context-message-'+props.messageId)?.scrollIntoView({block:'center'})})
</script>
<template><FpDialog :open="!!messageId" title="聊天室消息上下文" :width="760" @close="emit('close')"><div class="chat-context">
 <p>定位消息 {{ messageId }}。上下文按时间升序显示，每次翻页替换当前窗口。</p>
 <p><button type="button" :disabled="context.busy.value" @click="context.read">重读定位消息</button><button type="button" @click="emit('latest')">返回最新消息</button></p>
 <p v-if="context.busy.value" role="status">正在读取消息上下文…</p><p v-if="context.error.value" role="alert">{{ context.error.value }} <button type="button" :disabled="context.busy.value" @click="context.retry">重试本次上下文读取</button></p>
 <button v-if="context.list.value.length" type="button" :disabled="context.busy.value||!context.hasBefore.value" @click="context.previous">读取前一页上下文</button>
 <ol><li v-for="message in context.list.value" :id="'context-message-'+message.id" :key="message.id" :class="{anchor:message.id===messageId}"><p><strong>{{ message.id===messageId?'定位消息 · ':'' }}{{ message.author.userNickname||message.author.userName }}</strong> · {{ new Date(message.createdAt).toLocaleString() }}</p><div v-if="message.type==='text'" class="vditor-reset" v-html="message.contentHtml" /><p v-else-if="message.type==='unavailable'">当前消息不可读取</p><pre v-else>{{ message.type==='redPacket'?'红包':message.type==='music'?'音乐':'天气' }}卡片：{{ JSON.stringify(message.card,null,2) }}</pre></li></ol>
 <button v-if="context.list.value.length" type="button" :disabled="context.busy.value||!context.hasAfter.value" @click="context.next">读取后一页上下文</button>
 </div></FpDialog></template>
<style scoped lang="scss">.chat-context{overflow-wrap:anywhere;min-width:0}ol{list-style:none;padding:0;margin:10px 0;max-height:55vh;overflow:auto}li{padding:10px 6px;border-bottom:1px solid var(--fp-border)}li.anchor{border-left:3px solid var(--fp-accent);background:var(--fp-bg)}p{margin:6px 0;font-size:13px}pre{white-space:pre-wrap}button{font:inherit;padding:5px 8px;margin:3px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}button:disabled{opacity:.5}[role=alert]{color:#bd503c}:deep(img){max-width:100%}</style>
