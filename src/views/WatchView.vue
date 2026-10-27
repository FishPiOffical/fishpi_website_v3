<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { fetchV3FollowingFeed, type FollowingSource, type FollowingFeedPage } from '@/api/v3-following-feed'
import { useAuthStore } from '@/stores/auth'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import BreezemoonList from '@/components/breezemoons/BreezemoonList.vue'
import SideBar from '@/components/SideBar.vue'
import { usePageSeo } from '@/composables/usePageSeo'
const TABS:{tab:FollowingSource;to:string;label:string}[]=[{tab:'tags',to:'/watch',label:'关注标签'},{tab:'users',to:'/watch/users',label:'关注用户'},{tab:'breezemoons',to:'/watch/breezemoons',label:'清风明月'}]
const route=useRoute(),{accessToken,account}=storeToRefs(useAuthStore())
const current=computed(()=>TABS.find(tab=>tab.tab===route.meta.watchTab)||TABS[0]!)
const mounted=ref(false),loading=ref(false),error=ref(''),result=ref<FollowingFeedPage|null>(null),page=ref(1)
const ready=computed(()=>mounted.value&&!!accessToken.value&&!!account.value)
let sequence=0,boundary=''
function identity(){return `${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId||''}:${account.value?.userName||''}:${current.value.tab}`}
function clear(){sequence++;result.value=null;loading.value=false;error.value=''}
async function load(){
  if(!ready.value||loading.value)return
  const currentRequest=++sequence,reader=identity(),name=account.value!.userName,source=current.value.tab,requested=page.value
  loading.value=true;result.value=null;error.value=''
  const valid=()=>mounted.value&&ready.value&&currentRequest===sequence&&reader===identity()
  try{const value=await fetchV3FollowingFeed(name,source,requested);if(valid())result.value=value}
  catch(err){if(valid())error.value=err instanceof ApiError&&err.status===403?'当前无权读取关注动态。':err instanceof Error?err.message:'关注动态读取失败'}
  finally{if(valid())loading.value=false}
}
function move(value:number){if(loading.value||!result.value||value<1||value>Math.min(result.value.pageCount,42949672))return;page.value=value;void load()}
function home(){page.value=1;void load()}
watch([accessToken,()=>account.value?.oId,()=>account.value?.userName,()=>current.value.tab],()=>{const next=identity();if(next===boundary)return;boundary=next;clear();page.value=1;void load()},{flush:'sync'})
onMounted(()=>{mounted.value=true;boundary=identity();void load()})
onBeforeUnmount(()=>{mounted.value=false;clear()})
usePageSeo(()=>({title:`关注 · ${current.value.label}`,path:route.path,robots:'noindex'}))
</script>
<template>
  <div class="wrapper watch-wrap">
    <main class="content"><section class="module">
      <header class="watch-head"><h1>关注</h1><nav aria-label="关注动态类型"><RouterLink v-for="tab in TABS" :key="tab.tab" :to="tab.to" :class="{current:current.tab===tab.tab}">{{ tab.label }}</RouterLink></nav></header>
      <p v-if="!mounted" class="message">正在准备关注动态…</p>
      <p v-else-if="!ready" class="message"><RouterLink :to="{path:'/login',query:{redirect:route.fullPath}}">登录后查看关注动态</RouterLink></p>
      <template v-else>
        <div class="controls"><button type="button" :disabled="loading" @click="load">重新读取动态</button><span v-if="result">共 {{ result.total }} 条</span></div>
        <p v-if="loading" class="message" role="status">正在读取…</p>
        <div v-else-if="error" class="message"><p role="alert">{{ error }}</p><button v-if="page>1" type="button" @click="home">返回第一页</button></div>
        <template v-else-if="result">
          <p v-if="!result.list.length" class="message">{{ result.total?'本页没有动态，可返回第一页重新读取。':'暂无当前可展示的关注动态' }}<button v-if="page>1" type="button" @click="home">返回第一页</button></p>
          <BreezemoonList v-else-if="result.source==='breezemoons'" :items="result.list" />
          <ArticleFeed v-else :items="result.list" />
          <nav v-if="result.total||page>1" class="pager" aria-label="关注动态分页"><button type="button" :disabled="page<=1||loading" @click="move(page-1)">上一页</button><span>{{ page }} / {{ result.pageCount }}</span><button type="button" :disabled="page>=Math.min(result.pageCount,42949672)||loading" @click="move(page+1)">下一页</button></nav>
        </template>
      </template>
    </section></main>
    <aside class="side"><SideBar /></aside>
  </div>
</template>
<style scoped lang="scss">
.watch-head { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--fp-border); } h1 { margin: 0; font-size: 20px; } nav,.controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; } nav a { color: var(--fp-muted); } nav a.current { color: var(--fp-link); } .controls,.pager { padding: 16px 18px; } .message { padding: 18px; line-height: 1.7; overflow-wrap: anywhere; } .message a { color: var(--fp-link); } button { padding: 7px 11px; border: 1px solid var(--fp-border); border-radius: 8px; background: transparent; color: var(--fp-text); cursor: pointer; } button:disabled { opacity: .5; cursor: default; } [role='alert'] { color: #c34a36; }
</style>
