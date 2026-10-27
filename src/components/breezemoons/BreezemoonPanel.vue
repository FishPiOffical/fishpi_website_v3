<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useBreezemoonFeed } from '@/composables/useBreezemoonFeed'
import { fetchV3Breezemoon } from '@/api/v3-breezemoons'
import { useV3BreezemoonStore } from '@/stores/v3Breezemoons'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { consumeBreezemoonPagePayload } from '@/seo/payload'
import BreezemoonComposer from './BreezemoonComposer.vue'
import BreezemoonList from './BreezemoonList.vue'
const props=withDefaults(defineProps<{size?:number;compact?:boolean;manage?:boolean;ssrScope?:'global'|'home'}>(),{size:20,compact:false,manage:false})
const{accessToken,account}=storeToRefs(useAuthStore()),operations=useV3BreezemoonStore(),editor=ref<{id:string;content:string}|null>(null),editLoading=ref(false),editError=ref('')
const bootstrap=props.ssrScope?consumeBreezemoonPagePayload(props.ssrScope):null
const{mounted,result,loading,error,page,load,move,home}=useBreezemoonFeed(props.size,bootstrap)
const canManage=computed(()=>props.manage&&mounted.value&&!!accessToken.value&&!!account.value)
async function edit(id:string){
  if(editLoading.value||operations.pending||operations.busy||operations.confirming)return
  const valid=operations.capture(),version=operations.revision;editLoading.value=true;editError.value=''
  try{const row=await fetchV3Breezemoon(id);if(valid()&&mounted.value&&version===operations.revision){if(row.author.id!==account.value?.oId)throw Error('当前用户不能编辑该动态');editor.value={id:row.id,content:row.content}}}
  catch(err){if(valid()&&mounted.value)editError.value=err instanceof Error?err.message:'动态原文读取失败'}
  finally{if(valid()&&mounted.value)editLoading.value=false}
}
function remove(id:string){const row=result.value?.list.find(item=>item.id===id);if(row&&row.author.id===account.value?.oId)void operations.remove(row.id,row.content)}
let reader=`${getAuthContextVersion()}:${account.value?.oId||''}`
watch([accessToken,()=>account.value?.oId],()=>{const next=`${getAuthContextVersion()}:${account.value?.oId||''}`;if(!accessToken.value||next!==reader){editor.value=null;editError.value='';editLoading.value=false}reader=next},{flush:'sync'})
</script>
<template>
  <div class="moon-panel" :class="{compact}">
    <BreezemoonComposer :target="editor" @cancel="editor=null" @saved="editor=null" />
    <p v-if="editError" role="alert">{{ editError }}</p>
    <div class="controls"><button type="button" :disabled="loading" @click="load()">重新读取清风</button><span v-if="result">共 {{ result.total }} 条</span></div>
    <p v-if="loading" role="status">正在读取清风明月…</p>
    <template v-else-if="error"><p role="alert">{{ error }}</p><button v-if="page>1" type="button" @click="home">返回第一页</button></template>
    <template v-else-if="result">
      <BreezemoonList v-if="result.list.length" :items="result.list" :compact="compact"><template #actions="{item}"><template v-if="canManage&&item.author.id===account?.oId"><button type="button" :disabled="editLoading||!!operations.pending||operations.busy||operations.confirming" @click="edit(item.id)">编辑</button><button type="button" :disabled="editLoading||!!operations.pending||operations.busy||operations.confirming" @click="remove(item.id)">删除</button></template></template></BreezemoonList>
      <p v-else>{{ result.total?'本页没有动态，可返回第一页。':'暂无清风明月动态' }}<button v-if="page>1" type="button" @click="home">返回第一页</button></p>
      <nav v-if="!compact&&(result.total||page>1)" aria-label="清风明月分页"><button type="button" :disabled="page<=1" @click="move(page-1)">上一页</button><span>{{ page }} / {{ result.pageCount }}</span><button type="button" :disabled="page>=Math.min(result.pageCount,42949672)" @click="move(page+1)">下一页</button></nav>
    </template>
  </div>
</template>
<style scoped lang="scss">
.moon-panel { min-width: 0; padding: 0 18px 18px; } .compact { padding: 0; font-size: 12px; } .controls,nav { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 12px 0; } button { padding: 6px 9px; border: 1px solid var(--fp-border); border-radius: 6px; background: var(--fp-card); color: var(--fp-text); cursor: pointer; } button:disabled { opacity: .5; cursor: default; } p { overflow-wrap: anywhere; } [role='alert'] { color: #c34a36; }
</style>
