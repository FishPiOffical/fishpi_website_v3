<script setup lang="ts">
import {computed,ref} from 'vue'
import {getApiMode} from '@/api/mode'
import {useChatStore} from '@/stores/chat'
import {useAuthStore} from '@/stores/auth'
import ChatTopicEditor from '@/components/chat/ChatTopicEditor.vue'
import ChatTopicRecovery from '@/components/chat/ChatTopicRecovery.vue'
const chat=useChatStore(),auth=useAuthStore(),editing=ref(false),credential=computed(()=>getApiMode()==='v1'?auth.apiKey:auth.accessToken)
</script>
<template><div><p># {{ chat.discuss||'暂无话题' }}</p><button v-if="credential&&!editing" type="button" @click="editing=true">修改话题</button><ChatTopicEditor v-if="editing" @close="editing=false" /><ChatTopicRecovery /></div></template>
