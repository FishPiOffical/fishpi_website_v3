<script setup lang="ts">
import {computed,onMounted,ref} from 'vue'
import type {RepeaterEntry} from '@/api/v3-repeater'
import {useAuthStore} from '@/stores/auth'
import {useV3RepeaterStore} from '@/stores/v3Repeater'
const props=defineProps<{item:RepeaterEntry}>(),auth=useAuthStore(),store=useV3RepeaterStore(),blocked=computed(()=>store.busy||!!store.pending)
function set(){if(!blocked.value&&auth.accessToken)void store.like(props.item.id,!props.item.liked)}
const mounted=ref(false);onMounted(()=>{mounted.value=true})
</script>
<template><button v-if="mounted&&auth.accessToken&&auth.account?.oId" type="button" class="repeater-like" :disabled="blocked" :aria-label="item.liked ? '取消点赞' : '点赞'" :title="item.liked ? '取消点赞' : '点赞'" :aria-pressed="item.liked" @click="set"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M7 10H4v10h3m0-10 5-7c2 0 3 1 2 4l-1 3h5c2 0 2 1 2 2l-2 7-1 1H7V10Z"/></svg><span>{{ item.likeCount }}</span></button></template>

<style scoped>
.repeater-like { display:inline-flex; align-items:center; justify-content:center; align-self:flex-end; flex:none; gap:6px; width:auto; min-height:30px; padding:4px 10px; border:1px solid var(--fp-border); border-radius:8px; background:var(--fp-card); color:var(--fp-muted); font:inherit; font-size:12px; cursor:pointer; }
.repeater-like svg { width:15px; height:15px; }
.repeater-like:hover, .repeater-like[aria-pressed=true] { background:var(--fp-accent-soft); color:var(--fp-accent); border-color:currentColor; }
.repeater-like:disabled { opacity:.5; cursor:default; }
</style>
