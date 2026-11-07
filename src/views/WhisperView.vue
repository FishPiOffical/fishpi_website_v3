<script setup lang="ts">
import {computed} from 'vue'
import {useRoute} from 'vue-router'
import V3PrivateMessages from '@/components/chat/V3PrivateMessages.vue'
const route=useRoute()
const initialName=computed(()=>String(route.params.userName||route.query.toUser||''))
const initialId=computed(()=>String(route.query.peerId||''))
</script>
<template><div class="whisper-page fp-page fp-page--wide fp-ui"><V3PrivateMessages :initial-name="initialName" :initial-id="initialId" auto-select-first /></div></template>
<style scoped lang="scss">.whisper-page{min-width:0;display:flex;flex-direction:column;min-height:0;height:calc(100dvh - var(--fp-nav-h, 60px) - 34px);overflow:hidden}</style>
