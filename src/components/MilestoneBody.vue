<script setup lang="ts">
import {onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {markdownPreview} from '@/api/v3-markdown'
import type {Milestone} from '@/api/v3-milestones'
import {useAuthStore} from '@/stores/auth'
const props=defineProps<{item:Milestone;owned:boolean}>(),auth=useAuthStore(),html=ref(''),error=ref(''),loading=ref(false)
let mounted=false,sequence=0,abort:AbortController|null=null
function clear(){sequence++;abort?.abort();abort=null;html.value='';error.value='';loading.value=false}
async function render(){clear();if(!props.owned){html.value=props.item.contentHtml||'';return}if(!mounted||!auth.accessToken)return;const run=sequence,boundary=getAuthContextVersion(),owner=auth.account?.oId,token=auth.accessToken,target=props.item.id,body=props.item.content,controller=new AbortController();abort=controller;const valid=()=>mounted&&run===sequence&&boundary===getAuthContextVersion()&&owner===auth.account?.oId&&token===auth.accessToken&&target===props.item.id&&body===props.item.content;loading.value=true;try{const cleaned=await markdownPreview(body,controller.signal);if(valid())html.value=cleaned}catch(e){if(valid())error.value=e instanceof Error?e.message:'正文清洗失败'}finally{if(valid())loading.value=false}}
watch([()=>props.item,()=>props.owned,()=>auth.accessToken,()=>auth.account?.oId],()=>void render(),{immediate:true,flush:'sync'});onMounted(()=>{mounted=true;if(props.owned)void render()});onBeforeUnmount(()=>{mounted=false;clear()})
</script>
<template><div class="milestone-body"><p v-if="loading" role="status">正在准备正文…</p><p v-if="error" role="alert">{{ error }} <button type="button" @click="render">重试正文</button></p><div v-if="html" class="content-reset" v-html="html"/></div></template>
<style scoped lang="scss">.milestone-body{overflow-wrap:anywhere;min-width:0}.milestone-body :deep(img),.milestone-body :deep(video){max-width:100%;height:auto}.milestone-body :deep(pre){max-width:100%;overflow:auto}.milestone-body :deep(table){display:block;max-width:100%;overflow:auto}[role=alert]{color:#bd503c}</style>
