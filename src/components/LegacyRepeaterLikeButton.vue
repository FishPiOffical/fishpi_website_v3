<script setup lang="ts">
import {computed,onMounted,ref} from 'vue'
import type {RepeaterEntry} from '@/api/v3-repeater'
import {useAuthStore} from '@/stores/auth'
import {useLegacyRepeaterStore} from '@/stores/legacyRepeater'
const props=defineProps<{item:RepeaterEntry}>(),auth=useAuthStore(),store=useLegacyRepeaterStore(),blocked=computed(()=>store.busy||!!store.pending)
function set(){if(!blocked.value&&auth.apiKey)void store.toggleLike(props.item.id)}
const mounted=ref(false);onMounted(()=>{mounted.value=true})
</script>
<template><button v-if="mounted&&auth.apiKey&&auth.account?.oId" type="button" :disabled="blocked" :aria-pressed="item.liked" @click="set">{{ item.liked?'取消点赞':'点赞' }} {{ item.likeCount }}</button></template>
