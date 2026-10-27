<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { fetchV3SavedContent, type SavedPage, type SavedKind } from '@/api/v3-saved-content'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import { useAuthStore } from '@/stores/auth'
import { usePageSeo } from '@/composables/usePageSeo'
const route = useRoute(), { accessToken, account } = storeToRefs(useAuthStore())
const mounted=ref(false), loading=ref(false), error=ref(''), result=ref<SavedPage|null>(null), page=ref(1)
const privatePage=computed(()=>route.name==='stars')
const kind=computed<SavedKind>(()=>route.meta.memberTab==='followingTags'?'tags':route.meta.memberTab==='watchingArticles'?'subscriptions':'collections')
const target=computed(()=>privatePage.value ? account.value?.userName || '' : String(route.params.userName || ''))
const owner=computed(()=>mounted.value && !!accessToken.value && !!account.value && (privatePage.value || target.value.toLowerCase()===account.value.userName.toLowerCase()))
const title=computed(()=>privatePage.value?'我的收藏':`${target.value} · ${kind.value==='tags'?'关注标签':kind.value==='subscriptions'?'订阅文章':'收藏文章'}`)
const base=computed(()=>`/member/${encodeURIComponent(target.value)}`)
let sequence=0,boundary=''
function identity(){return `${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId||''}:${account.value?.userName||''}:${target.value}:${kind.value}:${owner.value}`}
function clear(){sequence++;result.value=null;error.value='';loading.value=false}
async function load(){
  if(!mounted.value || loading.value || privatePage.value && !owner.value)return
  const current=++sequence,reader=identity(),requested=page.value,name=target.value,type=kind.value,isOwner=owner.value
  loading.value=true;result.value=null;error.value=''
  const valid=()=>mounted.value && current===sequence && reader===identity()
  try{const value=await fetchV3SavedContent(name,type,isOwner,requested);if(valid())result.value=value}
  catch(err){if(valid())error.value=err instanceof ApiError&&err.status===403?'当前无权查看该列表。':err instanceof ApiError&&err.status===404?'用户不存在或当前不可访问。':err instanceof Error?err.message:'列表读取失败'}
  finally{if(valid())loading.value=false}
}
function move(value:number){if(loading.value||!result.value||value<1||value>Math.min(result.value.pageCount,42949672))return;page.value=value;void load()}
function home(){page.value=1;void load()}
watch([accessToken,()=>account.value?.oId,()=>account.value?.userName,target,kind,owner,privatePage],()=>{const next=identity();if(next===boundary)return;boundary=next;clear();page.value=1;void load()},{flush:'sync'})
onMounted(()=>{mounted.value=true;boundary=identity();void load()})
onBeforeUnmount(()=>{mounted.value=false;clear()})
usePageSeo(()=>({title:title.value,path:route.path,robots:'noindex'}))
</script>
<template>
  <section class="saved-content">
    <h1>{{ title }}</h1>
    <p v-if="!mounted">正在准备列表…</p>
    <p v-else-if="privatePage && !owner"><RouterLink :to="{path:'/login',query:{redirect:route.fullPath}}">登录后查看我的收藏</RouterLink></p>
    <template v-else>
      <nav aria-label="用户关注内容"><RouterLink :to="`${base}/following/tags`">关注标签</RouterLink><RouterLink :to="`${base}/following/articles`">收藏文章</RouterLink><RouterLink :to="`${base}/watching/articles`">订阅文章</RouterLink><RouterLink :to="base">用户主页</RouterLink></nav>
      <p v-if="owner && kind!=='tags'">本人记录保留当前不可读的条目，正文仍按当前阅读权限判断。</p>
      <button type="button" :disabled="loading" @click="load">重新读取列表</button>
      <p v-if="loading" role="status">正在读取…</p>
      <template v-else-if="error"><p role="alert">{{ error }}</p><button v-if="page>1" type="button" @click="home">返回第一页</button></template>
      <template v-else-if="result">
        <p>共 {{ result.total }} 条</p>
        <p v-if="!result.list.length">{{ result.total?'本页没有记录，可返回第一页重新读取。':'暂无记录' }}</p>
        <button v-if="!result.list.length && page>1" type="button" @click="home">返回第一页</button>
        <ul v-if="result.kind==='tags'" class="tags"><li v-for="tag in result.list" :key="tag.id"><RouterLink :to="`/tag/${tag.id}`">{{ tag.title }}</RouterLink><p v-if="tag.description">{{ tag.description }}</p><p>{{ tag.articleCount }} 篇文章 · {{ tag.followerCount }} 人关注</p></li></ul>
        <template v-else><template v-for="item in result.list" :key="item.id"><ArticleFeed v-if="item.available" :items="[item.article]" /><p v-else class="unavailable">该条目当前不可查看 · 文章 ID：{{ item.id }}</p></template></template>
        <nav v-if="result.total||page>1" aria-label="关注内容分页"><button type="button" :disabled="page<=1||loading" @click="move(page-1)">上一页</button><span>{{ page }} / {{ result.pageCount }}</span><button type="button" :disabled="page>=Math.min(result.pageCount,42949672)||loading" @click="move(page+1)">下一页</button></nav>
      </template>
    </template>
  </section>
</template>
<style scoped lang="scss">
.saved-content { max-width: 900px; margin: 24px auto; padding: 0 20px; } h1 { font-size: 22px; overflow-wrap: anywhere; } nav { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin: 16px 0; } a { color: var(--fp-link); } p { line-height: 1.7; overflow-wrap: anywhere; } .tags { list-style: none; padding: 0; } .tags li, .unavailable { border-top: 1px solid var(--fp-border); padding: 16px 0; } button { padding: 8px 12px; border: 1px solid var(--fp-border); border-radius: 8px; color: var(--fp-text); background: transparent; cursor: pointer; } button:disabled { opacity: .5; cursor: default; } [role='alert'] { color: #c34a36; }
</style>
