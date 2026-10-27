<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { fetchV3AnonymousContent, type AnonymousEntry, type AnonymousKind } from '@/api/v3-anonymous-content'
import { useAuthStore } from '@/stores/auth'
import { usePageSeo } from '@/composables/usePageSeo'
const route = useRoute(), { accessToken, account } = storeToRefs(useAuthStore())
const mounted = ref(false), loading = ref(false), error = ref(''), list = ref<AnonymousEntry[]>([]), page = ref(1), pageCount = ref(0), total = ref(0)
const kind = computed<AnonymousKind>(() => route.meta.memberTab === 'commentsAnonymous' ? 'comments' : 'articles')
const title = computed(() => kind.value === 'articles' ? '本人匿名文章' : '本人匿名评论')
const target = computed(() => String(route.params.userName || ''))
const self = computed(() => mounted.value && !!accessToken.value && !!account.value && target.value === account.value.userName)
const base = computed(() => `/member/${encodeURIComponent(account.value?.userName || '')}`)
let sequence = 0, boundary = ''
function identity() { return accessToken.value ? `${getAuthContextVersion()}:${account.value?.oId || ''}:${account.value?.userName || ''}:${target.value}:${kind.value}` : '' }
function clear() { sequence++; list.value = []; error.value = ''; pageCount.value = total.value = 0; loading.value = false }
async function load() {
  if (!self.value || loading.value) return
  const current = ++sequence, owner = identity(), requested = page.value
  loading.value = true; list.value = []; error.value = ''
  try { const result = await fetchV3AnonymousContent(kind.value, requested); if (mounted.value && current === sequence && self.value && owner === identity()) { list.value = result.list; pageCount.value = result.pageCount; total.value = result.total } }
  catch (err) { if (mounted.value && current === sequence && self.value && owner === identity()) error.value = err instanceof Error ? err.message : '匿名内容读取失败' }
  finally { if (mounted.value && current === sequence && owner === identity()) loading.value = false }
}
function move(value: number) { if (loading.value || value < 1 || value > Math.min(pageCount.value, 42949672)) return; page.value = value; void load() }
function home() { page.value = 1; void load() }
watch([accessToken, () => account.value?.oId, () => account.value?.userName, target, kind], () => { const next = identity(); if (next === boundary) return; boundary = next; clear(); page.value = 1; void load() }, { flush: 'sync' })
onMounted(() => { mounted.value = true; boundary = identity(); void load() })
onBeforeUnmount(() => { mounted.value = false; clear() })
usePageSeo(() => ({ title: title.value, path: route.path, robots: 'noindex' }))
function date(value: number) { return new Date(value).toLocaleString() }
</script>
<template>
  <section class="anonymous-content">
    <h1>{{ title }}</h1>
    <p v-if="!mounted">正在准备本人内容…</p>
    <p v-else-if="!accessToken"><RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录后查看本人匿名内容</RouterLink></p>
    <template v-else-if="!self"><p>匿名创作列表仅供本人查看。</p><RouterLink v-if="account" :to="`${base}/${kind}/anonymous`">查看我自己的列表</RouterLink></template>
    <template v-else>
      <nav aria-label="本人匿名创作"><RouterLink :to="`${base}/articles/anonymous`">匿名文章</RouterLink><RouterLink :to="`${base}/comments/anonymous`">匿名评论</RouterLink><RouterLink :to="base">返回本人主页</RouterLink></nav>
      <p>这里只显示概要。正文需进入文章，按当前阅读权限查看。</p>
      <button type="button" :disabled="loading" @click="load">重新读取列表</button>
      <p v-if="loading" role="status">正在读取…</p>
      <template v-else-if="error"><p role="alert" class="error">{{ error }}</p><button v-if="page > 1" type="button" @click="home">返回第一页</button></template>
      <template v-else>
        <p>共 {{ total }} 条</p><p v-if="!list.length">{{ total ? '本页没有记录，可返回第一页重新读取。' : '暂无当前可列出的匿名内容' }}</p>
        <button v-if="!list.length && page > 1" type="button" @click="home">返回第一页</button>
        <ul><li v-for="item in list" :key="item.id">
          <template v-if="'title' in item"><RouterLink :to="`/article/${item.id}`">{{ item.title || '无标题文章' }}</RouterLink><p>文章 ID：{{ item.id }}</p><p>创建：{{ date(item.createdAt) }} · 更新：{{ date(item.updatedAt) }}</p></template>
          <template v-else><RouterLink :to="`/article/${item.articleId}`">{{ item.articleTitle || '无标题文章' }}</RouterLink><p>评论 ID：{{ item.id }} · {{ item.visibility === 1 ? '私密评论' : '普通评论' }}</p><p>评论创建：{{ date(item.createdAt) }}</p></template>
        </li></ul>
        <nav v-if="total || page > 1" aria-label="匿名内容分页"><button type="button" :disabled="page <= 1 || loading" @click="move(page - 1)">上一页</button><span>{{ page }} / {{ pageCount }}</span><button type="button" :disabled="page >= Math.min(pageCount, 42949672) || loading" @click="move(page + 1)">下一页</button></nav>
      </template>
    </template>
  </section>
</template>
<style scoped lang="scss">
.anonymous-content { max-width: 900px; margin: 24px auto; padding: 0 20px; } h1 { font-size: 22px; } nav { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin: 16px 0; } a { color: var(--fp-link); } p { line-height: 1.7; overflow-wrap: anywhere; } ul { list-style: none; padding: 0; } li { border-top: 1px solid var(--fp-border); padding: 16px 0; overflow-wrap: anywhere; } button { padding: 8px 12px; border: 1px solid var(--fp-border); border-radius: 8px; color: var(--fp-text); background: transparent; cursor: pointer; } button:disabled { opacity: .5; cursor: default; } .error { color: #c34a36; }
</style>
