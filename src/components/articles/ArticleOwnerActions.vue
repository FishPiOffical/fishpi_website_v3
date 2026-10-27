<script setup lang="ts">
import { computed,onBeforeUnmount,onMounted,ref,watch } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { articleOwnerProof,type OwnerOperation,type OwnerReceipt } from '@/api/v3-article-owner'
import { useV3ArticleOwnerStore } from '@/stores/v3ArticleOwner'
const props=withDefaults(defineProps<{articleId:string;authorId?:string;anonymous?:boolean;permanent?:boolean}>(),{authorId:'',anonymous:false,permanent:false})
const emit=defineEmits<{changed:[id:string];deleted:[id:string]}>()
const {accessToken,account}=storeToRefs(useAuthStore()),operations=useV3ArticleOwnerStore()
const mounted=ref(false),opened=ref(false),loading=ref(false),proof=ref<{id:string;status:number}|null>(null),error=ref('')
const authenticated=computed(()=>mounted.value&&!!accessToken.value&&!!account.value?.oId)
const candidate=computed(()=>authenticated.value&&(props.anonymous||!!props.authorId&&props.authorId===account.value?.oId))
const currentReceipt=computed(()=>operations.receipt?.id===props.articleId?operations.receipt:null)
const locked=computed(()=>operations.busy||operations.confirming||!!operations.pending)
const origin=Symbol('article-owner-confirmation')
let sequence=0,controller:AbortController|null=null
const identity=()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||'',props.articleId])
function close(){sequence++;controller?.abort();controller=null;operations.cancelConfirmation(origin);opened.value=false;loading.value=false;proof.value=null;error.value=''}
async function check(){
 if(!candidate.value)return
 controller?.abort();const abort=new AbortController();controller=abort;const run=++sequence,reader=identity()
 opened.value=true;loading.value=true;proof.value=null;error.value=''
 const valid=()=>authenticated.value&&opened.value&&run===sequence&&reader===identity()&&!abort.signal.aborted
 try{const result=await articleOwnerProof(props.articleId,abort.signal);if(valid())proof.value=result}
 catch(reason){if(valid())error.value=reason instanceof Error?reason.message:'本人文章信息读取失败'}
 finally{if(valid()){loading.value=false;if(controller===abort)controller=null}}
}
async function completed(result:OwnerReceipt|null,reader:string){
 if(!result||!authenticated.value||reader!==identity()||result.id!==props.articleId)return
 close();if(result.kind==='delete')emit('deleted',result.id);else emit('changed',result.id)
}
async function run(kind:OwnerOperation){if(!candidate.value||!proof.value||proof.value.id!==props.articleId||proof.value.status!==0||locked.value||kind==='stick'&&props.permanent)return;const reader=identity();await completed(await operations.start(kind,props.articleId,origin),reader)}
async function recover(){const reader=identity();await completed(await operations.retry(),reader)}
watch(identity,close,{flush:'sync'})
onMounted(()=>{mounted.value=true})
onBeforeUnmount(()=>{mounted.value=false;close()})
</script>
<template>
 <div v-if="authenticated&&(candidate||operations.pending||currentReceipt)" class="owner-actions">
  <button v-if="candidate" type="button" :disabled="operations.busy||operations.confirming" :aria-expanded="opened" @click="opened?close():check()">本人文章操作</button>
  <p v-if="currentReceipt" role="status">{{ currentReceipt.kind==='delete'?'删除已确认':`本次置顶已确认，支付${currentReceipt.paidPoints}积分；当前状态以重新读取为准。` }}</p>
  <p v-if="operations.accountError&&(operations.pending?.id===articleId||currentReceipt)" role="status">{{ operations.accountError }}</p>
  <div v-if="operations.pending" class="recovery">
   <p>文章 {{ operations.pending.id }} 的{{ operations.pending.kind==='stick'?'置顶':'删除' }}结果未确认，请先恢复本次操作。</p>
   <p v-if="operations.error" role="alert">{{ operations.error }}</p>
   <button type="button" :disabled="operations.busy||operations.confirming" @click="recover">恢复本次文章操作</button>
  </div>
  <div v-if="opened">
   <p v-if="loading" role="status">正在核验本人文章…</p>
   <p v-if="error" role="alert">{{ error }} <button type="button" :disabled="locked" @click="check">重试本人文章信息</button></p>
   <template v-if="proof">
    <RouterLink v-if="anonymous" :to="`/post/${articleId}`">{{ proof.status===0?'编辑本人文章':'查看本人原文' }}</RouterLink>
    <p v-if="proof.status!==0">当前文章状态不允许删除或付费置顶。</p>
    <p v-else>删除须满足平台条件，删除文章及历史后无法恢复；付费置顶每次100积分。</p>
    <button type="button" :disabled="locked||proof.status!==0||permanent" @click="run('stick')">{{ permanent?'管理员永久置顶':'付费置顶（100积分）' }}</button>
    <button type="button" :disabled="locked||proof.status!==0" @click="run('delete')">删除本人文章</button>
   </template>
   <p v-if="operations.error&&!operations.pending" role="alert">{{ operations.error }}</p>
  </div>
 </div>
</template>
<style scoped lang="scss">
.owner-actions {display:flex;flex-direction:column;align-items:flex-start;gap:6px;max-width:100%;overflow-wrap:anywhere;}
button {border:1px solid var(--fp-border);border-radius:6px;background:var(--fp-bg);color:var(--fp-text);padding:5px 8px;cursor:pointer;}
button:disabled {opacity:.5;cursor:default;}
p {margin:0;font-size:13px;color:var(--fp-muted);}[role='alert'] {color:#c34a36;}
</style>
