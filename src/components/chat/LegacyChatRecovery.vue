<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import {useChatStore} from '@/stores/chat'
const emit=defineEmits<{confirmed:[content:string]}>(),chat=useChatStore()
</script>
<template><div v-if="getApiMode()==='v1'" class="legacy-chat-state"><p v-if="chat.legacySendError" role="alert">{{ chat.legacySendError }}</p><div v-if="chat.legacyPending" role="status"><p>发送结果未确认。请先读取当前消息核对；刷新或退出会清除本机核对信息。</p><details><summary>待核对正文</summary><pre>{{ chat.legacyPending.content }}</pre></details><button :disabled="chat.sending||chat.loading" @click="chat.refreshMessages">读取当前消息</button><button :disabled="chat.sending" @click="chat.legacyRelease">我已核对，解除锁定</button></div></div></template>
<style scoped>.legacy-chat-state{font-size:13px;overflow-wrap:anywhere}p{margin:6px 0}[role=alert]{color:#bd503c}pre{white-space:pre-wrap;max-height:100px;overflow:auto}button{font:inherit;color:inherit;border:1px solid var(--fp-border);border-radius:6px;background:var(--fp-card);padding:5px 8px;margin:3px}</style>
