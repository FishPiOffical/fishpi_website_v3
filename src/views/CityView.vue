<script setup lang="ts">
import {computed} from 'vue'
import {RouterLink,useRoute} from 'vue-router'
import {usePageSeo} from '@/composables/usePageSeo'
import {useCityFeed} from '@/composables/useCityFeed'
import {avatarUrl,DEFAULT_AVATAR} from '@/utils/avatar'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import VipNickname from '@/components/user/VipNickname.vue'
import SideBar from '@/components/SideBar.vue'
const route=useRoute(),cityName=computed(()=>String(route.params.cityName||'')),feed=useCityFeed(cityName),{sort}=feed
const {value:users,loading:usersLoading,error:usersError,p:usersPage}=feed.users,{value:articles,loading:articlesLoading,error:articlesError,p:articlesPage}=feed.articles
usePageSeo(()=>({title:`${cityName.value} · 同城`,path:route.path,description:`${cityName.value}的公开同城用户与文章`,robots:'noindex'}))
function fallback(event:Event){const image=event.target as HTMLImageElement;if(image.getAttribute('src')!==DEFAULT_AVATAR)image.src=DEFAULT_AVATAR}
</script>
<template><div class="wrapper list-page-wrap fp-page fp-page--wide fp-ui fp-list-page"><div class="content">
<section class="module"><header class="module-header list-page-head"><h1 class="fp-page-title">📍 {{ cityName||'同城' }}</h1></header><p class="scope-hint">按公开位置展示同城用户和署名文章；不包含匿名文章或讨论帖。</p></section>
<section class="module"><header class="module-header list-page-head"><h2>同城用户</h2><button class="fp-control" type="button" :disabled="usersLoading" @click="feed.users.read()">刷新用户</button></header><p v-if="usersLoading" role="status" class="empty-hint">正在读取同城用户…</p><p v-if="usersError" role="alert" class="err fp-state">{{ usersError }} <button class="fp-control" type="button" @click="feed.users.read()">重试用户</button></p><template v-if="users"><p class="scope-hint">共{{ users.total }}位公开位置的同城用户</p><p v-if="!users.list.length" class="empty-hint">本页没有同城用户。</p><ul class="city-list"><li v-for="user in users.list" :key="user.id" class="city-item"><RouterLink :to="'/member/'+encodeURIComponent(user.userName)" class="city-avatar-link" :data-user-card="user.userName"><img class="city-avatar" :src="avatarUrl(user)" :data-user-card="user.userName" alt="" loading="lazy" @error="fallback"/></RouterLink><div class="city-main"><RouterLink :to="'/member/'+encodeURIComponent(user.userName)" :data-user-card="user.userName"><VipNickname :user-id="user.id" :user-name="user.userName" :text="user.userNickname||user.userName"/></RouterLink><p>@{{ user.userName }}</p><p class="body">{{ user.userIntro }}</p></div></li></ul><nav class="fp-pagination" aria-label="同城用户分页"><button class="fp-control" type="button" :disabled="usersLoading||users.p<=1" @click="feed.users.read(users.p-1)">上一页用户</button><span>第{{ users.p }}页 / {{ users.pageCount }}页</span><button class="fp-control" type="button" :disabled="usersLoading||users.p>=Math.min(users.pageCount,42949672)" @click="feed.users.read(users.p+1)">下一页用户</button></nav></template><button class="fp-control" v-if="!usersLoading&&usersPage>1&&(!users||!users.list.length)" type="button" @click="feed.users.read(1)">返回用户第一页</button></section>
<section class="module"><header class="module-header list-page-head"><h2>同城文章</h2><label>排序<select class="fp-control" v-model="sort"><option value="latest">最新发布</option><option value="active">最近活跃</option><option value="hot">热度</option><option value="comments">评论数</option></select></label><button class="fp-control" type="button" :disabled="articlesLoading" @click="feed.articles.read()">刷新文章</button></header><p v-if="articlesLoading" role="status" class="empty-hint">正在读取同城文章…</p><p v-if="articlesError" role="alert" class="err fp-state">{{ articlesError }} <button class="fp-control" type="button" @click="feed.articles.read()">重试文章</button></p><template v-if="articles"><p class="scope-hint">共{{ articles.total }}篇公开署名文章</p><ArticleFeed :items="articles.list" empty="本页没有同城文章。"/><nav class="fp-pagination" aria-label="同城文章分页"><button class="fp-control" type="button" :disabled="articlesLoading||articles.p<=1" @click="feed.articles.read(articles.p-1)">上一页文章</button><span>第{{ articles.p }}页 / {{ articles.pageCount }}页</span><button class="fp-control" type="button" :disabled="articlesLoading||articles.p>=Math.min(articles.pageCount,42949672)" @click="feed.articles.read(articles.p+1)">下一页文章</button></nav></template><button class="fp-control" v-if="!articlesLoading&&articlesPage>1&&(!articles||!articles.list.length)" type="button" @click="feed.articles.read(1)">返回文章第一页</button></section>
</div><aside class="side"><SideBar/></aside></div></template>
<style scoped lang="scss">
.list-page-wrap {
  padding-top: 4px;
}

.list-page-head {
  padding: 12px 18px;
  > button {
    display: none;
  }
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.head-left h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--fp-title);
}

.sub-tag {
  font-size: 12px;
  color: var(--fp-muted);
}

.head-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.total-count {
  font-size: 12px;
  color: var(--fp-muted);
}

.scope-hint {
  padding: 10px 18px;
  margin: 0;
  background: var(--fp-hover);
  color: var(--fp-muted);
  font-size: 12px;
  border-bottom: 1px solid var(--fp-border);
}

.empty-hint,
.err {
  padding: 36px 18px;
  margin: 0;
  text-align: center;
  color: var(--fp-muted);
  font-size: 14px;
}

.err {
  color: var(--fp-danger, #e07a5f);
}

.city-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.city-item {
  display: flex;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--fp-border);
  transition: background-color 0.15s ease;
}

.city-item:last-child {
  border-bottom: 0;
}

.city-item:hover {
  background: var(--fp-hover);
}

.city-avatar-link {
  flex-shrink: 0;
  text-decoration: none;
}

.city-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.city-avatar.fallback {
  display: grid;
  place-items: center;
  background: var(--fp-hover);
  color: var(--fp-title);
  font-weight: 600;
  font-size: 14px;
}

.city-main {
  flex: 1;
  min-width: 0;
}

.city-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
  font-size: 13px;
}

.city-meta a {
  color: var(--fp-title);
  text-decoration: none;
}

.city-meta a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.city-meta time {
  color: var(--fp-muted);
  font-size: 12px;
}

.city-pill {
  font-size: 11px;
  color: var(--fp-muted);
  background: var(--fp-hover);
  padding: 1px 7px;
  border-radius: 999px;
}

.body {
  font-size: 14px;
  line-height: 1.6;
  color: var(--fp-text);
  word-break: break-all;
  overflow-wrap: anywhere;
}

.body :deep(a) {
  word-break: break-all;
  overflow-wrap: anywhere;
}

.body :deep(p) {
  margin: 0;
  word-break: break-all;
  overflow-wrap: anywhere;
}
nav{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 18px}.module{margin-bottom:16px}.list-page-head{display:flex;flex-wrap:wrap;align-items:center;gap:12px}h1,h2{margin:0;font-size:18px}button,select{font:inherit;padding:6px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-bg);color:var(--fp-text)}.city-main p{margin:6px 0;overflow-wrap:anywhere}
</style>
