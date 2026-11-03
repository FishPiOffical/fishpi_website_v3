<script setup lang="ts">
import {nextTick,onMounted,onBeforeUnmount,ref,watch} from 'vue'
import {storeToRefs} from 'pinia'
import {useAuthStore} from '@/stores/auth'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {registerArticleRead} from '@/api/v3-article-reads'
const props=defineProps<{articleId:string;authorId:string}>(),{accessToken,account}=storeToRefs(useAuthStore())
const error=ref(''),retryable=ref(false),busy=ref(false)
let mounted=false,generation=0,bound='',attempted=false,abort:AbortController|null=null
const identity=()=>JSON.stringify([props.articleId,props.authorId,account.value?.oId||'',Boolean(accessToken.value),getAuthContextVersion()])
async function register(retry=false){
 if(!mounted)return
 const reader=identity()
 if(bound!==reader){bound=reader;generation++;abort?.abort();abort=null;attempted=false;error.value='';retryable.value=false;busy.value=false}
 const actor=account.value?.oId
 if(!accessToken.value||!actor||!props.authorId||actor===props.authorId||attempted&&!retry||busy.value)return
 attempted=true;busy.value=true;error.value='';retryable.value=false
 const run=++generation;abort=new AbortController();const signal=abort.signal,target=props.articleId
 const current=()=>mounted&&run===generation&&reader===identity()&&!signal.aborted
 // The full reader/body must have been mounted, never SSR/prefetch or a Markdown preview.
 await nextTick()
 if(!current())return
 try{await registerArticleRead(target,signal)}
 catch(e){if(current()){
  if(e instanceof ApiError&&(e.status===404||e.status===409&&e.code==='own_article'))return
  error.value=e instanceof ApiError&&e.status===403?'当前授权未包含阅读登记权限':e instanceof Error?e.message:'阅读登记失败'
  retryable.value=!(e instanceof ApiError&&[401,403,404,409,422].includes(e.status))
 }}finally{if(current())busy.value=false}
}
watch(identity,()=>{void register()},{flush:'post'})
onMounted(()=>{mounted=true;void register()})
onBeforeUnmount(()=>{mounted=false;generation++;abort?.abort();error.value=''})
</script>
<template><p v-if="error" class="article-read-status" role="status">阅读登记未完成：{{ error }} <button v-if="retryable" type="button" :disabled="busy" @click="register(true)">重试阅读登记</button></p></template>
<style scoped lang="scss">
.article-read-status{font-size:12px;line-height:1.7;color:var(--fp-muted);overflow-wrap:anywhere}button{font:inherit;color:var(--fp-title);background:transparent;border:1px solid var(--fp-border);border-radius:6px;padding:3px 7px;cursor:pointer;&:disabled{opacity:.5}}
</style>
