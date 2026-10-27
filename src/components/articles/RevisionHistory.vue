<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { revisionPage,revisionDetail,type RevisionKind,type RevisionMeta,type RevisionPage,type RevisionDetail } from '@/api/v3-revisions'
import { decodeEntities } from '@/utils/text'
import { useAuthStore } from '@/stores/auth'
const props=withDefaults(defineProps<{kind:RevisionKind;targetId:string;trigger?:boolean}>(),{trigger:true})
const emit=defineEmits<{openChange:[value:boolean]}>()
const {accessToken,account}=storeToRefs(useAuthStore())
const heading=ref<HTMLElement|null>(null)
const mounted=ref(false),opened=ref(false),page=ref(1),listing=ref<RevisionPage|null>(null),detail=ref<RevisionDetail|null>(null),selected=ref<RevisionMeta|null>(null)
const loading=ref(false),busy=ref(false),listError=ref(''),detailError=ref('')
const authenticated=computed(()=>mounted.value&&!!accessToken.value&&!!account.value)
const title=computed(()=>detail.value?.title===undefined?'':decodeEntities(detail.value.title))
const content=computed(()=>detail.value?decodeEntities(detail.value.content):'')
let listSequence=0,detailSequence=0,boundary=''
function identity(){return `${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId||''}:${props.kind}:${props.targetId}`}
function clearDetail(){detailSequence++;detail.value=null;selected.value=null;detailError.value='';busy.value=false}
function clear(){listSequence++;clearDetail();listing.value=null;loading.value=false;listError.value=''}
function close(){opened.value=false;clear();emit('openChange',false)}
async function load(nextPage=page.value){
  if(!authenticated.value||!opened.value)return
  const reader=identity(),current=++listSequence,kind=props.kind,target=props.targetId
  const valid=()=>authenticated.value&&opened.value&&reader===identity()&&current===listSequence
  clearDetail();listError.value='';loading.value=true;page.value=nextPage
  try{const value=await revisionPage(kind,target,nextPage);if(valid())listing.value=value}
  catch(reason){if(valid()){listing.value=null;listError.value=reason instanceof Error?reason.message:'历史列表读取失败'}}
  finally{if(valid())loading.value=false}
}
function toggle(){if(!authenticated.value)return;if(opened.value){close();return}opened.value=true;page.value=1;emit('openChange',true);void load(1);const reader=identity();void nextTick(()=>{if(authenticated.value&&opened.value&&reader===identity()){heading.value?.focus?.({preventScroll:true});heading.value?.scrollIntoView?.({behavior:'smooth',block:'nearest'})}})}
async function select(meta:RevisionMeta){
  if(busy.value&&selected.value?.id===meta.id)return
  if(!authenticated.value||!opened.value||loading.value||!listing.value?.items.some(item=>item.id===meta.id&&item.index===meta.index))return
  const current=++detailSequence,reader=identity(),kind=props.kind,target=props.targetId
  const valid=()=>authenticated.value&&opened.value&&reader===identity()&&current===detailSequence
  selected.value=meta;detail.value=null;detailError.value='';busy.value=true
  try{const value=await revisionDetail(kind,target,meta);if(valid())detail.value=value}
  catch(reason){if(valid())detailError.value=reason instanceof Error?reason.message:'历史正文读取失败'}
  finally{if(valid())busy.value=false}
}
function date(time:number|null){if(time===null)return'修改时间未知';const value=new Date(time);return Number.isFinite(value.getTime())?value.toLocaleString():String(time)}
watch([accessToken,()=>account.value?.oId,()=>props.kind,()=>props.targetId],()=>{const next=identity();if(next===boundary)return;boundary=next;close()},{flush:'sync'})
onMounted(()=>{mounted.value=true;boundary=identity()})
onBeforeUnmount(()=>{mounted.value=false;close()})
defineExpose({toggle,opened})
</script>
<template>
  <section v-if="authenticated" class="revision-history" :aria-label="`${kind==='article'?'文章':'评论'}修订历史`">
    <button v-if="trigger" type="button" :aria-expanded="opened" @click="toggle()">{{ opened?'收起历史':'修订历史' }}</button>
    <div v-if="opened" class="history-content">
      <h3 ref="heading" tabindex="-1">{{ kind==='article'?'文章':'评论' }}修订历史</h3>
      <p>历史内容可能包含后来删除的文字。</p>
      <p v-if="loading" role="status">正在读取历史列表…</p>
      <p v-if="listError" role="alert">{{ listError }}</p>
      <button type="button" :aria-disabled="loading" :aria-busy="loading" @click="!loading&&load()">{{ listError?'重试历史列表':'刷新历史列表' }}</button>
      <template v-if="listing">
        <p v-if="!listing.items.length">{{ listing.pagination.total===0?'暂无保存的历史记录':'本页没有历史记录，请返回前页' }}</p>
        <ol>
          <li v-for="meta in listing.items" :key="meta.id"><button type="button" :aria-pressed="selected?.id===meta.id" :aria-busy="busy&&selected?.id===meta.id" :aria-disabled="loading||busy&&selected?.id===meta.id" @click="select(meta)">#{{ meta.index }} {{ meta.current?'当前版本':date(meta.time) }}</button></li>
        </ol>
        <nav v-if="listing.pagination.pageCount>1||listing.pagination.page>1" aria-label="历史分页">
          <button type="button" :aria-disabled="listing.pagination.page<=1||loading" @click="listing.pagination.page>1&&!loading&&load(listing.pagination.page-1)">上一页</button>
          <span v-if="listing.pagination.page<=listing.pagination.pageCount">{{ listing.pagination.page }} / {{ listing.pagination.pageCount }} · {{ listing.pagination.total }}条</span><span v-else>共{{ listing.pagination.total }}条</span>
          <button type="button" :aria-disabled="listing.pagination.page>=listing.pagination.pageCount||loading" @click="listing.pagination.page<listing.pagination.pageCount&&!loading&&load(listing.pagination.page+1)">下一页</button>
        </nav>
      </template>
      <p v-if="busy" role="status">正在读取历史正文…</p>
      <p v-if="detailError" role="alert">{{ detailError }}</p>
      <button v-if="detailError&&selected&&!busy" type="button" @click="select(selected)">重试历史正文</button>
      <div v-if="detail" class="history-text">
        <h4 v-if="kind==='article'">{{ title||'（无标题）' }}</h4>
        <p v-if="detail.current">当前版本 · {{ date(detail.time) }}</p>
        <pre v-if="content">{{ content }}</pre><p v-else>（无正文）</p>
      </div>
    </div>
  </section>
</template>
<style scoped lang="scss">
.revision-history { max-width: 100%; min-width: 0; overflow-wrap: anywhere; button { border: 1px solid var(--fp-border); background: transparent; color: var(--fp-text); border-radius: 6px; padding: 5px 9px; cursor: pointer; } button[aria-pressed='true'] { color: var(--fp-link); border-color: var(--fp-primary); } button[aria-disabled='true'] { opacity: .5; cursor: default; } [role='alert'] { color: #c34a36; } }
.history-content { padding: 12px 0; border-top: 1px solid var(--fp-border); margin-top: 8px; h3,h4 { margin: 6px 0; } p { margin: 6px 0; } ol { padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; } nav { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; } }
.history-text { margin-top: 10px; pre { white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--fp-font-mono,monospace); margin: 8px 0; } }
</style>
