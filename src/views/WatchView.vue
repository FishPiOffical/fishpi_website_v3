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
      <header class="watch-head">
        <div class="watch-heading-row">
          <div class="watch-title-group">
            <h1>关注动态</h1>
            <span v-if="result" class="watch-count">{{ result.total }} 条动态</span>
          </div>
          <button v-if="ready" class="watch-refresh" type="button" :disabled="loading" :aria-busy="loading" aria-label="刷新关注动态" title="刷新动态" @click="load">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17"/></svg>
          </button>
        </div>
        <nav class="watch-tabs" aria-label="关注动态类型">
          <RouterLink v-for="tab in TABS" :key="tab.tab" :to="tab.to" :class="{current:current.tab===tab.tab}" :aria-current="current.tab===tab.tab ? 'page' : undefined">{{ tab.label }}</RouterLink>
        </nav>
      </header>
      <p v-if="!mounted" class="message">正在准备关注动态…</p>
      <p v-else-if="!ready" class="message"><RouterLink :to="{path:'/login',query:{redirect:route.fullPath}}">登录后查看关注动态</RouterLink></p>
      <template v-else>
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
  padding: 20px 22px 0;
  border-bottom: 1px solid var(--fp-divider);
}
.watch-heading-row,
.watch-title-group { display: flex; align-items: center; gap: 12px; min-width: 0; }
.watch-heading-row { justify-content: space-between; margin-bottom: 12px; min-height: 32px; }
.watch-title-group { flex-wrap: wrap; gap: 6px 12px; }
.watch-head h1 { margin: 0; font-size: 20px; line-height: 1.4; font-weight: 650; color: var(--fp-title); }
.watch-count { color: var(--fp-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.watch-head .watch-refresh {
  display: grid; place-items: center; flex: none; width: 32px; height: 32px;
  padding: 0; border: 0; border-radius: 8px; color: var(--fp-muted); background: transparent;
  transition: background 160ms ease;
}
.watch-refresh:hover:not(:disabled) { background: var(--fp-hover); }
.watch-tabs { display: flex; gap: 26px; overflow-x: auto; }
.watch-tabs a {
  position: relative; flex: none; padding: 10px 0 13px; font-size: 14px; line-height: 20px;
  color: var(--fp-muted); text-decoration: none; white-space: nowrap;
}
.watch-tabs a:hover { text-decoration: none; background: var(--fp-hover); }
.watch-tabs a.current { color: var(--fp-text); font-weight: 600; }
.watch-tabs a.current::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; border-radius: 3px 3px 0 0; background: var(--fp-accent); }
.watch-tabs a:focus-visible,
.watch-refresh:focus-visible { outline: 2px solid var(--fp-accent); outline-offset: -2px; }
@media (max-width: 600px) {
  .watch-head { padding: 16px 16px 0; }
  .watch-head h1 { font-size: 18px; }
  .watch-tabs { gap: 22px; }
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
