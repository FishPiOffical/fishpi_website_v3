<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {RouterLink} from 'vue-router'
import {getAuthContextVersion} from '@/api/http'
import {legacyOwnerProof,type LegacyOwnerProof,type LegacyOwnerKind} from '@/api/legacy/article-owner'
import {useAuthStore} from '@/stores/auth'
import {useLegacyArticleOwnerStore} from '@/stores/legacyArticleOwner'
const props=withDefaults(defineProps<{articleId:string;authorId?:string;anonymous?:boolean}>(),{authorId:'',anonymous:false})
const emit=defineEmits<{changed:[id:string];deleted:[id:string]}>(),auth=useAuthStore(),operations=useLegacyArticleOwnerStore()
const mounted=ref(false),opened=ref(false),loading=ref(false),proof=ref<LegacyOwnerProof|null>(null),error=ref('')
const authenticated=computed(()=>mounted.value&&!!auth.apiKey&&!!auth.account?.oId)
const candidate=computed(()=>authenticated.value&&!props.anonymous&&!!props.authorId&&props.authorId===auth.account?.oId)
const locked=computed(()=>loading.value||operations.busy||operations.confirming||!!operations.pending)
const origin=Symbol('legacy-owner-confirmation');let sequence=0,controller:AbortController|null=null
const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId,props.articleId,props.authorId,props.anonymous])
function close(){sequence++;controller?.abort();controller=null;opened.value=false;proof.value=null;loading.value=false;error.value='';operations.cancelConfirmation(origin)}
async function check(){
 if(!candidate.value||locked.value)return
 const reader=identity(),run=++sequence,abort=new AbortController();controller?.abort();controller=abort;opened.value=true;loading.value=true;proof.value=null;error.value=''
 const valid=()=>mounted.value&&candidate.value&&opened.value&&reader===identity()&&run===sequence&&!abort.signal.aborted
 try{const result=await legacyOwnerProof(props.articleId,auth.account!.oId,abort.signal);if(valid())proof.value=result}
 catch(failure){if(valid())error.value=failure instanceof Error?failure.message:'本人文章核验失败'}
 finally{if(valid()){loading.value=false;controller=null}}
}
async function start(kind:LegacyOwnerKind){
 if(!candidate.value||locked.value||proof.value?.status!==0||kind==='stick'&&(!proof.value||!['none','temporary'].includes(proof.value.stick)))return
 const reader=identity(),result=await operations.start(kind,props.articleId,origin)
 if(!result||!mounted.value||reader!==identity()||result.id!==props.articleId)return
 close();if(result.kind==='delete')emit('deleted',result.id);else emit('changed',result.id)
}
watch(identity,close,{flush:'sync'})
onMounted(()=>{mounted.value=true})
onBeforeUnmount(()=>{mounted.value=false;close()})
</script>
<template>
 <section v-if="authenticated&&(candidate||operations.pending||operations.receipt?.id===articleId)" class="legacy-owner">
  <button v-if="candidate" type="button" :aria-expanded="opened" :disabled="operations.busy||operations.confirming" @click="opened?close():check()">本人文章操作</button>
  <p v-if="operations.receipt?.id===articleId" role="status">{{ operations.receipt.kind==='delete'?'删除已确认':'本次置顶已确认，当前状态请重新读取；旧接口不返回实际费用或置顶时间。' }}</p>
  <p v-if="operations.accountError&&operations.receipt?.id===articleId" role="status">{{ operations.accountError }}</p>
  <div v-if="operations.pending"><p>文章 {{ operations.pending.id }} 的{{ operations.pending.kind==='delete'?'删除':'置顶' }}结果未确认。旧接口不能幂等恢复，请先核对。</p><RouterLink :to="'/article/'+operations.pending.id">查看原文章</RouterLink><button type="button" :disabled="operations.busy||operations.confirming" @click="operations.release()">我已核对，解除锁定</button></div>
  <p v-if="operations.error" role="alert">{{ operations.error }}</p>
  <div v-if="opened"><p v-if="loading" role="status">正在核验本人文章…</p><p v-if="error" role="alert">{{ error }} <button type="button" :disabled="locked" @click="check()">重试核验</button></p><template v-if="proof"><p>旧接口没有本人完整编辑原文，暂不提供编辑；删除条件由平台最终核验。</p><p v-if="proof.status!==0">当前文章状态不允许操作。</p><p v-else-if="proof.stick==='permanent'">管理员永久置顶不可覆盖。</p><p v-else-if="proof.stick==='unknown'">置顶状态未知，暂不能付费置顶。</p><button type="button" :disabled="locked||proof.status!==0||!['none','temporary'].includes(proof.stick)" @click="start('stick')">付费置顶</button><button type="button" :disabled="locked||proof.status!==0" @click="start('delete')">删除本人文章</button></template></div>
 </section>
</template>
<style scoped>.legacy-owner{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px;max-width:100%;overflow-wrap:anywhere}p{margin:4px 0;font-size:12.5px;color:var(--fp-muted)}.legacy-owner>button{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;border:1px solid var(--fp-border);border-radius:999px;background:var(--fp-card);color:var(--fp-muted);font-size:12px;margin:0}button{font:inherit;font-size:12px;padding:4px 10px;border:1px solid var(--fp-border);border-radius:999px;background:var(--fp-card);color:var(--fp-text);cursor:pointer;margin:2px}button:disabled{opacity:.5;cursor:default}[role=alert]{color:#c34a36}</style>
