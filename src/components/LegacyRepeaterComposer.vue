<script setup lang="ts">
import {onMounted,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {REPEATER_KINDS} from '@/api/v3-repeater'
import {useAuthStore} from '@/stores/auth'
import {useLegacyRepeaterStore} from '@/stores/legacyRepeater'
const auth=useAuthStore(),store=useLegacyRepeaterStore(),type=ref('joke'),content=ref(''),submitted=ref('')
async function submit(){if(!auth.apiKey||store.busy||store.pending)return;submitted.value=JSON.stringify({type:type.value,content:content.value});await store.publish(type.value,content.value)}
watch(()=>store.completed,c=>{if(c?.kind==='publish'&&JSON.stringify({type:c.type,content:c.content})===submitted.value){content.value='';submitted.value=''}})
watch(()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId||'']),()=>{content.value='';submitted.value='';type.value='joke'},{flush:'sync'})
const mounted=ref(false);onMounted(()=>{mounted.value=true})
</script>
<template><form v-if="mounted&&auth.apiKey&&auth.account?.oId" class="repeater-composer" @submit.prevent="submit"><h2>投稿复读内容</h2><label>类型<select v-model="type" :disabled="store.busy||!!store.pending"><option v-for="kind in REPEATER_KINDS" :key="kind.value" :value="kind.value">{{ kind.label }}</option></select></label><label>正文<textarea v-model="content" maxlength="8192" rows="3" :disabled="store.busy||!!store.pending"/></label><p>保存时去除HTML并合并空白，结果须为2至500个UTF-16单位。投稿成功不代表进入当前前12条榜单。</p><button type="submit" :disabled="store.busy||!!store.pending||content.trim().length<2">{{ store.busy?'提交中…':'投稿' }}</button></form></template>
<style scoped lang="scss">.repeater-composer{display:flex;flex-direction:column;gap:8px;padding:12px 0}h2{font-size:15px;margin:0}label{display:flex;flex-direction:column;gap:5px}select,textarea,button{font:inherit;padding:6px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}p{margin:0;font-size:12px;color:var(--fp-muted)}textarea{box-sizing:border-box;width:100%}button{align-self:flex-start}</style>
