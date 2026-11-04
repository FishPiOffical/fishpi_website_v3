<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import {computed,onMounted,onBeforeUnmount,ref,watch} from 'vue'
import {RouterLink} from 'vue-router'
import {storeToRefs} from 'pinia'
import {useAuthStore} from '@/stores/auth'
import {getAuthContextVersion} from '@/api/http'
import {fetchArticleColumn,type ArticleColumnContext} from '@/api/v3-article-column'
import {fetchColumnChapters,type ColumnChapterPage} from '@/api/v3-public-columns'
const props=defineProps<{articleId:string}>(),{accessToken,apiKey}=storeToRefs(useAuthStore()),credential=computed(()=>getApiMode()==='v1'?apiKey.value:accessToken.value)
const context=ref<ArticleColumnContext|null>(null),error=ref(''),loading=ref(false),opened=ref(false),page=ref<ColumnChapterPage|null>(null),pageNo=ref(1),pageError=ref(''),pageLoading=ref(false)
let mounted=false,generation=0,pageRun=0,abort:AbortController|null=null
const identity=()=>JSON.stringify([props.articleId,credential.value,getAuthContextVersion()])
async function readContext(){
 if(!mounted)return;const version=++generation,reader=identity();abort?.abort();abort=new AbortController();const signal=abort.signal;pageRun++;context.value=null;page.value=null;error.value='';pageError.value='';loading.value=true;pageLoading.value=false
 try{const result=await fetchArticleColumn(props.articleId,signal);if(mounted&&version===generation&&reader===identity()){context.value=result;if(opened.value&&result.column)void readPage(pageNo.value)}}
 catch(e){if(mounted&&version===generation&&reader===identity())error.value=e instanceof Error?e.message:'章节导航读取失败'}
 finally{if(mounted&&version===generation)loading.value=false}
}
async function readPage(p=1){
 const columnId=context.value?.column?.id;if(!mounted||!columnId)return;const run=++pageRun,version=generation,reader=identity();pageNo.value=p;page.value=null;pageError.value='';pageLoading.value=true
 try{const result=await fetchColumnChapters(columnId,p);if(mounted&&version===generation&&run===pageRun&&reader===identity()&&context.value?.column?.id===columnId)page.value=result}
 catch(e){if(mounted&&version===generation&&run===pageRun&&reader===identity())pageError.value=e instanceof Error?e.message:'章节目录读取失败'}
 finally{if(mounted&&version===generation&&run===pageRun)pageLoading.value=false}
}
function toggle(){opened.value=!opened.value;if(opened.value&&!page.value)void readPage(pageNo.value)}
watch(identity,(_,prior)=>{if(!mounted)return;const previous=JSON.parse(prior||'[]');if(previous[0]!==props.articleId||previous[2]!==getAuthContextVersion()||!credential.value){opened.value=false;pageNo.value=1}void readContext()},{flush:'sync'})
onMounted(()=>{mounted=true;void readContext()})
onBeforeUnmount(()=>{mounted=false;generation++;pageRun++;abort?.abort();context.value=null;page.value=null})
</script>
<template>
 <div class="article-column-navigation">
  <p v-if="loading" role="status">正在读取章节导航…</p>
  <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="readContext">重试章节导航</button></p>
  <template v-else-if="context?.column">
   <p><RouterLink :to="`/column/${context.column.id}`">《{{ context.column.title }}》</RouterLink> · 第 {{ context.chapterNo }} 章 · {{ context.column.articleCount }} 个可见章节</p>
   <nav aria-label="当前可见章节导航">
    <RouterLink v-if="context.previous" :to="`/article/${context.previous.id}`">← 第 {{ context.previous.chapterNo }} 章 {{ context.previous.title }}</RouterLink>
    <RouterLink v-if="context.next" :to="`/article/${context.next.id}`">第 {{ context.next.chapterNo }} 章 {{ context.next.title }} →</RouterLink>
    <button type="button" :aria-expanded="opened" @click="toggle">章节目录</button>
   </nav>
   <section v-if="opened" aria-label="当前可见章节目录">
    <p v-if="pageLoading" role="status">正在读取章节目录…</p>
    <p v-else-if="pageError" role="alert">{{ pageError }} <button type="button" @click="readPage(pageNo)">重试当前目录页</button></p>
    <template v-else-if="page">
     <p>共 {{ page.total }} 个可见章节</p>
     <p v-if="!page.list.length">本页没有可见章节 <button type="button" @click="readPage(1)">返回目录首页</button></p>
     <ol><li v-for="item in page.list" :key="item.id"><RouterLink :aria-current="item.id===articleId?'page':undefined" :to="`/article/${item.id}`">第 {{ item.chapterNo }} 章 {{ item.title }}</RouterLink></li></ol>
    </template>
    <nav aria-label="章节目录分页"><button type="button" :disabled="pageLoading||pageNo<=1" @click="readPage(pageNo-1)">上一页目录</button><span>第 {{ pageNo }} 页<span v-if="page"> / 共 {{ Math.max(1,page.pageCount) }} 页</span></span><button type="button" :disabled="pageLoading||!page||pageNo>=page.pageCount" @click="readPage(pageNo+1)">下一页目录</button></nav>
   </section>
  </template>
 </div>
</template>
<style scoped lang="scss">
.article-column-navigation{font-size:14px;line-height:1.7;overflow-wrap:anywhere;margin:16px 0;color:var(--fp-muted)}nav{display:flex;flex-wrap:wrap;gap:10px;align-items:center}a{color:var(--fp-accent)}button{font:inherit;color:var(--fp-title);background:transparent;border:1px solid var(--fp-border);border-radius:6px;padding:4px 8px;cursor:pointer;&:disabled{opacity:.5;cursor:default}}section{margin:12px 0;padding:12px 0;border-top:1px solid var(--fp-border)}ol{padding-left:24px}li{margin:5px 0}[role=alert]{color:#bd503c}p{margin:8px 0}
</style>
