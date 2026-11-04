<script setup lang="ts">
import {computed,onMounted,ref} from 'vue'
import type {RepeaterEntry} from '@/api/v3-repeater'
import {useAuthStore} from '@/stores/auth'
import {useV3RepeaterStore} from '@/stores/v3Repeater'
const props=defineProps<{item:RepeaterEntry}>(),auth=useAuthStore(),store=useV3RepeaterStore(),blocked=computed(()=>store.busy||!!store.pending)
function set(){if(!blocked.value&&auth.accessToken)void store.like(props.item.id,!props.item.liked)}
const mounted=ref(false);onMounted(()=>{mounted.value=true})
</script>
<template><button v-if="mounted&&auth.accessToken&&auth.account?.oId" type="button" :disabled="blocked" :aria-pressed="item.liked" @click="set">{{ item.liked?'取消点赞':'点赞' }} {{ item.likeCount }}</button></template>
