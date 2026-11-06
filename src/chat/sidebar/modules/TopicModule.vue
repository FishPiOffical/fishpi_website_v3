<script setup lang="ts">
import {ref} from 'vue'
import {useChatStore} from '@/stores/chat'
import {useAuthStore} from '@/stores/auth'
import ChatTopicEditor from '@/components/chat/ChatTopicEditor.vue'
import ChatTopicRecovery from '@/components/chat/ChatTopicRecovery.vue'
const chat=useChatStore(),auth=useAuthStore(),editing=ref(false)
</script>
<template><div><p># {{ chat.discuss||'暂无话题' }}</p><button v-if="auth.accessToken&&!editing" type="button" @click="editing=true">修改话题</button><ChatTopicEditor v-if="editing" @close="editing=false" /><ChatTopicRecovery /></div></template>
