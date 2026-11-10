<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { fetchV3UserRelations, type RelationKind, type RelationUser } from '@/api/v3-user-relations'
import { useAuthStore } from '@/stores/auth'
import { usePageSeo } from '@/composables/usePageSeo'
import { avatarUrl, DEFAULT_AVATAR, avatarThumbnail } from '@/utils/avatar'
import VipNickname from '@/components/user/VipNickname.vue'
const route = useRoute(), { accessToken, account } = storeToRefs(useAuthStore())
const mounted = ref(false), loading = ref(false), error = ref(''), list = ref<RelationUser[]>([]), page = ref(1), pageCount = ref(0), total = ref<number | null>(null)
const target = computed(() => String(route.params.userName || ''))
const kind = computed<RelationKind>(() => route.meta.memberTab === 'followers' ? 'followers' : 'following')
const title = computed(() => `${target.value} · ${kind.value === 'followers' ? '粉丝' : '关注用户'}`)
let sequence = 0, boundary = ''
function identity() { return `${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId || ''}:${target.value}:${kind.value}` }
function clear() { sequence++; list.value = []; total.value = null; pageCount.value = 0; loading.value = false; error.value = '' }
async function load() {
  if (!mounted.value || loading.value) return
  const current = ++sequence, reader = identity(), requested = page.value, name = target.value, type = kind.value
  loading.value = true; list.value = []; total.value = null; error.value = ''
  try { const result = await fetchV3UserRelations(name, type, requested); if (mounted.value && current === sequence && reader === identity()) { list.value = result.list; pageCount.value = result.pageCount; total.value = result.total } }
  catch (err) { if (mounted.value && current === sequence && reader === identity()) error.value = err instanceof ApiError && err.status === 403 ? '当前无权查看该列表。' : err instanceof ApiError && err.status === 404 ? '用户不存在或当前不可访问。' : err instanceof Error ? err.message : '用户列表读取失败' }
  finally { if (mounted.value && current === sequence && reader === identity()) loading.value = false }
}
function move(value: number) { if (loading.value || value < 1 || value > Math.min(pageCount.value, 42949672)) return; page.value = value; void load() }
function home() { page.value = 1; void load() }
function fallback(event: Event) { const image = event.target as HTMLImageElement; if (image.getAttribute('src') !== DEFAULT_AVATAR) image.src = DEFAULT_AVATAR }
watch([accessToken, () => account.value?.oId, target, kind], () => { const next = identity(); if (next === boundary) return; boundary = next; clear(); page.value = 1; void load() }, { flush: 'sync' })
onMounted(() => { mounted.value = true; boundary = identity(); void load() })
onBeforeUnmount(() => { mounted.value = false; clear() })
usePageSeo(() => ({ title: title.value, path: route.path, robots: 'noindex' }))
</script>
<template>
  <section class="user-relations fp-page fp-ui fp-surface">

    <p v-if="!mounted">正在准备用户列表…</p>
    <template v-else>
      <button type="button" class="refresh-rel-btn fp-control" :disabled="loading" @click="load">重新读取列表</button>
      <p class="fp-state" v-if="loading" role="status">正在读取…</p>
      <div v-else-if="error" class="fp-state"><p role="alert">{{ error }}</p><div class="fp-state-actions"><button class="fp-control" type="button" :disabled="loading" @click="load">重试当前页</button><button class="fp-control" v-if="page > 1" type="button" @click="home">返回第一页</button></div></div>
      <template v-else-if="total !== null">
        <p>共 {{ total }} 位用户</p>
        <p class="fp-state" v-if="!list.length">{{ total ? '本页没有用户，可返回第一页重新读取。' : '暂无用户' }}</p>
        <button class="fp-control" v-if="!list.length && page > 1" type="button" @click="home">返回第一页</button>
        <ul><li v-for="user in list" :key="user.id"><RouterLink :to="`/member/${encodeURIComponent(user.userName)}`" :data-user-card="user.userName"><img :src="avatarThumbnail(avatarUrl(user), 40)" :data-user-card="user.userName" alt="" loading="lazy" @error="fallback" /><VipNickname :user-id="user.id" :user-name="user.userName" :text="user.userNickname || user.userName" /></RouterLink><span>@{{ user.userName }}</span></li></ul>
        <nav v-if="total || page > 1" aria-label="用户列表分页"><button class="fp-control" type="button" :disabled="page <= 1 || loading" @click="move(page - 1)">上一页</button><span>{{ page }} / {{ pageCount }}</span><button class="fp-control" type="button" :disabled="page >= Math.min(pageCount, 42949672) || loading" @click="move(page + 1)">下一页</button></nav>
      </template>
    </template>
  </section>
</template>
<style scoped lang="scss">
.user-relations {    .refresh-rel-btn { display: none; } } h1 { font-size: 22px; overflow-wrap: anywhere; } nav { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin: 16px 0; } a { color: var(--fp-link); } ul { list-style: none; padding: 0; } li { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 16px 0; border-top: 1px solid var(--fp-border); overflow-wrap: anywhere; } li a { display: flex; align-items: center; gap: 12px; min-width: 0; } img { width: 40px; height: 40px; object-fit: cover; border-radius: var(--fp-avatar-radius); flex-shrink: 0; } li span { overflow-wrap: anywhere; } button { padding: 8px 12px; border: 1px solid var(--fp-border); border-radius: 8px; background: transparent; color: var(--fp-text); cursor: pointer; } button:disabled { opacity: .5; cursor: default; } [role='alert'] { color: var(--fp-danger); }
</style>
