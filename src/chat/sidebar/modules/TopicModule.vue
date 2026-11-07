<script setup lang="ts">
import {ref} from 'vue'
import {useV3ChatTimelineStore} from '@/stores/v3ChatTimeline'
import {useChatStore} from '@/stores/chat'
import {useAuthStore} from '@/stores/auth'
import ChatTopicEditor from '@/components/chat/ChatTopicEditor.vue'
import ChatTopicRecovery from '@/components/chat/ChatTopicRecovery.vue'
const timeline=useV3ChatTimelineStore(),chat=useChatStore(),auth=useAuthStore(),editing=ref(false)
</script>
<template>
  <div class="topic-module">
    <div class="topic-content" :class="{ empty: !chat.discuss }">
      <span class="topic-mark" aria-hidden="true">#</span>
      <p>{{ chat.discuss || '还没有话题，聊点什么吧' }}</p>
    </div>
    <p v-if="chat.topicError" class="topic-error" role="alert">{{ chat.topicError }} <button type="button" @click="timeline.readTopic">重试</button></p>
    <div v-if="auth.accessToken && !editing" class="topic-footer">
      <span>此刻大家在聊</span>
      <button type="button" @click="editing = true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" /></svg>修改话题</button>
    </div>
    <ChatTopicEditor v-if="editing" @close="editing = false" />
    <ChatTopicRecovery />
  </div>
</template>
<style scoped>
.topic-content { display:flex; align-items:flex-start; gap:9px; padding:13px 12px; border:1px solid color-mix(in srgb,var(--fp-primary) 18%,var(--fp-border)); border-radius:8px; background:color-mix(in srgb,var(--fp-primary) 7%,var(--fp-card)); }
.topic-mark { flex:none; font-size:23px; font-weight:700; line-height:1.3; color:var(--fp-primary); opacity:.65; }
.topic-content p { margin:0; padding-top:2px; color:var(--fp-title); font-size:14px; line-height:1.7; font-weight:600; overflow-wrap:anywhere; white-space:pre-wrap; }
.topic-content.empty p { color:var(--fp-muted); font-weight:400; }
.topic-footer { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:6px; margin-top:8px; color:var(--fp-muted); font-size:11px; }
button { display:inline-flex; align-items:center; gap:4px; padding:4px 6px; border:0; border-radius:5px; background:transparent; color:var(--fp-muted); font:inherit; cursor:pointer; }
button:hover { background:var(--fp-hover); color:var(--fp-text); }
button:focus-visible { outline:2px solid var(--fp-primary); outline-offset:2px; }
svg { width:13px; height:13px; }
.topic-error { color:#bf503c; overflow-wrap:anywhere; }
</style>
