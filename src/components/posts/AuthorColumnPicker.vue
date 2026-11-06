<script setup lang="ts">
import { onBeforeUnmount,onMounted,ref,watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { authorColumns,type AuthorColumn } from '@/api/v3-author-columns'
const props=withDefaults(defineProps<{modelValue:string;currentTitle?:string;disabled?:boolean}>(),{currentTitle:'',disabled:false})
const emit=defineEmits<{select:[column:{id:string;title:string}]}>()
const {accessToken,account}=storeToRefs(useAuthStore())
const visible=ref(false)
const list=ref<AuthorColumn[]>([]),loaded=ref(false),loading=ref(false),error=ref(''),page=ref(1),pageCount=ref(0)
let mounted=false,sequence=0,controller:AbortController|null=null
const identity=()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||''])
function clear(){sequence++;controller?.abort();controller=null;list.value=[];loaded.value=false;loading.value=false;error.value='';page.value=1;pageCount.value=0}
async function load(p=page.value){
 if(!mounted||!accessToken.value||!account.value?.oId)return
 controller?.abort();const abort=new AbortController();controller=abort
 const reader=identity(),run=++sequence;page.value=p;loading.value=true;loaded.value=false;error.value='';list.value=[]
 const current=()=>mounted&&run===sequence&&reader===identity()&&!abort.signal.aborted
 try{const result=await authorColumns(p,abort.signal);if(current()){list.value=result.list;loaded.value=true;pageCount.value=result.pagination.pageCount}}
 catch(reason){if(current())error.value=reason instanceof Error?reason.message:'本人专栏读取失败'}
 finally{if(current()){loading.value=false;if(controller===abort)controller=null}}
}
function choose(event:Event){
 if(props.disabled||loading.value||error.value)return
 const value=(event.target as HTMLSelectElement).value,item=list.value.find(c=>c.id===value)
 if(item&&item.id!==props.modelValue)emit('select',{id:item.id,title:item.title})
}
watch(identity,()=>{clear();if(mounted)void load(1)},{flush:'sync'})
onMounted(()=>{mounted=true;visible.value=true;void load(1)})
onBeforeUnmount(()=>{mounted=false;clear()})
</script>
<template>
 <div v-if="visible&&accessToken" class="author-columns">
  <label>选择本人专栏
   <select :value="modelValue" :disabled="disabled||loading||Boolean(error)" @change="choose">
    <option value="" disabled>请选择专栏</option>
    <option v-if="modelValue&&!list.some(c=>c.id===modelValue)" :value="modelValue">{{ currentTitle||'当前绑定专栏' }}（{{ modelValue }}，未在本页）</option>
    <option v-for="column in list" :key="column.id" :value="column.id">{{ column.title||'未命名专栏' }}（{{ column.articleCount }}篇）</option>
   </select>
  </label>
  <p v-if="loading" role="status">正在读取本人专栏…</p>
  <p v-if="error" role="alert">{{ error }} <button type="button" :disabled="disabled" @click="load()">重试专栏列表</button></p>
  <p v-if="loaded&&!loading&&!error&&!list.length" role="status">{{ page>1?'本页没有专栏，可返回上一页。':'暂无本人专栏，可选择新建专栏。' }}</p>
  <div class="pages" v-if="pageCount>1||page>1">
   <button type="button" :disabled="disabled||loading||page<=1" @click="load(page-1)">上一页专栏</button>
   <span>{{ page }} / {{ Math.max(page,pageCount) }}</span>
   <button type="button" :disabled="disabled||loading||page>=pageCount" @click="load(page+1)">下一页专栏</button>
  </div>
 </div>
</template>
<style scoped lang="scss">
.author-columns {display:flex;flex-direction:column;gap:8px;min-width:0;}
label,.pages {display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
select {min-width:0;max-width:100%;flex:1;border:1px solid var(--fp-border);border-radius:6px;background:var(--fp-bg);color:var(--fp-text);padding:8px;}
p {margin:0;color:var(--fp-muted);font-size:13px;}
button {border:1px solid var(--fp-border);border-radius:6px;background:var(--fp-bg);color:var(--fp-text);padding:4px 8px;cursor:pointer;}
button:disabled {opacity:.5;cursor:default;}
</style>
