<script setup lang="ts">
import {computed} from 'vue'
import {useRoute} from 'vue-router'
import PrivateMessages from '@/components/chat/PrivateMessages.vue'
const route=useRoute()
const initialName=computed(()=>String(route.params.userName||route.query.toUser||''))
const initialId=computed(()=>String(route.query.peerId||''))
</script>
<template><div class="whisper-page"><h1>私信</h1><PrivateMessages :initial-name="initialName" :initial-id="initialId" /></div></template>
<style scoped lang="scss">.whisper-page{padding:18px;min-width:0}h1{font-size:22px;margin:0 0 16px}</style>
