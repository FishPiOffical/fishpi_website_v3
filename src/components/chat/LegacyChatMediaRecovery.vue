<script setup lang="ts">
import {computed} from 'vue'
import {useLegacyChatActionsStore} from '@/stores/legacyChatActions'
import {useChatStore} from '@/stores/chat'
const props=defineProps<{kind:'music'|'weather'}>(),store=useLegacyChatActionsStore(),chat=useChatStore(),label=computed(()=>props.kind==='music'?'音乐':'天气'),command=computed(()=>{const c=store.pending;return c&&(c.kind==='music'||c.kind==='weather')&&c.kind===props.kind?c:null})
</script>
<template><div class="media-state"><p v-if="store.error&&store.errorKind===kind" role="alert">{{ store.error }}</p><div v-if="command" role="status"><p>本次{{ label }}卡片发送结果未确认，请先核对当前消息。</p><details><summary>查看原卡片字段</summary><pre>{{ JSON.stringify(command.input,null,2) }}</pre></details><p>旧接口不支持幂等恢复，不会自动重发。</p><button type="button" :disabled="store.busy" @click="chat.refreshMessages">重读当前消息</button><button type="button" :disabled="store.busy" @click="store.release">我已核对，解除锁定</button></div><p v-if="store.completed?.kind===kind" role="status">本次{{ label }}卡片发送已确认，当前消息以重新读取为准。</p><p v-if="store.completed?.kind===kind&&chat.error" role="alert">{{ chat.error }} <button type="button" @click="chat.refreshMessages">重读当前消息</button></p></div></template>
<style scoped lang="scss">.media-state{overflow-wrap:anywhere}p,details{font-size:13px;margin:6px 0}pre{white-space:pre-wrap;word-break:break-word}[role=alert]{color:#bd503c}button{font:inherit;border:1px solid var(--fp-border);border-radius:5px;padding:5px 8px;margin:3px;background:var(--fp-card);color:var(--fp-text)}</style>
