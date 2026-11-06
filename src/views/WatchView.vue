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
  <div class="wrapper watch-wrap fp-page fp-page--wide fp-ui fp-list-page">
    <main class="content"><section class="module">
      <header class="watch-head fp-page-heading"><h1 class="fp-page-title">关注</h1><nav aria-label="关注动态类型"><RouterLink v-for="tab in TABS" :key="tab.tab" :to="tab.to" :class="{current:current.tab===tab.tab}">{{ tab.label }}</RouterLink></nav></header>
      <p v-if="!mounted" class="message">正在准备关注动态…</p>
      <p v-else-if="!ready" class="message"><RouterLink :to="{path:'/login',query:{redirect:route.fullPath}}">登录后查看关注动态</RouterLink></p>
      <template v-else>
        <div class="controls"><button class="fp-control" type="button" :disabled="loading" @click="load">重新读取动态</button><span v-if="result">共 {{ result.total }} 条</span></div>
        <p v-if="loading" class="message" role="status">正在读取…</p>
        <div v-else-if="error" class="message"><p role="alert">{{ error }}</p><button class="fp-control" v-if="page>1" type="button" @click="home">返回第一页</button></div>
        <template v-else-if="result">
          <p v-if="!result.list.length" class="message">{{ result.total?'本页没有动态，可返回第一页重新读取。':'暂无当前可展示的关注动态' }}<button class="fp-control" v-if="page>1" type="button" @click="home">返回第一页</button></p>
          <BreezemoonList v-else-if="result.source==='breezemoons'" :items="result.list" />
          <ArticleFeed v-else :items="result.list" />
          <nav v-if="result.total||page>1" class="pager" aria-label="关注动态分页"><button class="fp-control" type="button" :disabled="page<=1||loading" @click="move(page-1)">上一页</button><span>{{ page }} / {{ result.pageCount }}</span><button class="fp-control" type="button" :disabled="page>=Math.min(result.pageCount,42949672)||loading" @click="move(page+1)">下一页</button></nav>
        </template>
      </template>
    </section></main>
    <aside class="side"><SideBar /></aside>
  </div>
</template>
<style scoped lang="scss">
.watch-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--fp-divider);
}
h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}
nav,
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.controls button {
  display: none;
}
nav a {
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--fp-muted);
  text-decoration: none;
  transition: all 0.16s ease;

  &:hover {
    background: var(--fp-hover);
    color: var(--fp-title);
  }
}
nav a.current {
  background: color-mix(in srgb, var(--fp-accent) 14%, var(--fp-card));
  color: var(--fp-accent);
  font-weight: 600;
}
.controls {
  padding: 10px 18px 0;
  font-size: 12px;
  color: var(--fp-muted);
}
.pager {
  display: flex;
  justify-content: center;
  padding: 14px 18px;
  border-top: 1px solid var(--fp-divider);
}
.message {
  padding: 20px 18px;
  line-height: 1.7;
  overflow-wrap: anywhere;
  color: var(--fp-muted);
  text-align: center;
}
.message a {
  color: var(--fp-link);
}
button {
  padding: 6px 12px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-card);
  color: var(--fp-text);
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
[role='alert'] {
  color: var(--fp-danger);
}
</style>
