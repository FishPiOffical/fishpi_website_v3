<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { usePageSeo } from '@/composables/usePageSeo'
import { usePublicMedals } from '@/composables/usePublicMedals'
const route = useRoute(), userName = computed(() => String(route.params.userName || ''))
const { value, p, loading, error, read } = usePublicMedals(userName)
const panel = ref<HTMLElement | null>(null); let lastPage = 1
watch(value, data => { if (!data) return; const moved = lastPage !== data.p; lastPage = data.p; if (moved) void nextTick(() => { if (value.value === data) panel.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) }) })
usePageSeo(() => ({ title: `${userName.value} 的公开勋章`, path: `/member/${encodeURIComponent(userName.value)}/medals`, description: `${userName.value} 当前公开展示的有效勋章` }))
</script>
<template>
  <section ref="panel" class="public-medals">
    <h1><RouterLink :to="`/member/${encodeURIComponent(userName)}`">{{ userName }}</RouterLink> 的公开勋章</h1>
    <p>仅展示当前公开且有效的勋章。</p>
    <button type="button" :disabled="loading" @click="read()">刷新公开勋章</button>
    <p v-if="loading" role="status">正在读取公开勋章…</p>
    <div v-else-if="error" role="alert"><p>{{ error }}</p><button type="button" @click="read()">重试公开勋章</button><button v-if="p > 1" type="button" @click="read(1)">返回第一页</button></div>
    <template v-else-if="value">
      <p>共 {{ value.total }} 枚公开勋章</p>
      <ul class="medal-list"><li v-for="(medal, i) in value.list" :key="`${p}:${i}:${medal.id}`"><strong>{{ medal.name }}</strong><span v-if="medal.type" class="medal-type">{{ medal.type }}</span><p>{{ medal.description }}</p><small>{{ medal.expiresAt === 0 ? '永久有效' : `有效至 ${new Date(medal.expiresAt).toLocaleString('zh-CN')}` }}</small></li></ul>
      <p v-if="!value.list.length">本页没有公开勋章。</p>
      <div class="medal-pager"><button type="button" :disabled="p <= 1" @click="read(p - 1)">上一页勋章</button><span>第 {{ p }} 页 / 共 {{ value.pageCount }} 页</span><button type="button" :disabled="p >= value.pageCount" @click="read(p + 1)">下一页勋章</button></div>
    </template>
    <p v-else role="status">公开勋章尚未读取。</p>
  </section>
</template>
<style scoped lang="scss">
.public-medals { scroll-margin-top: 88px; max-width: 1000px; margin: 0 auto; padding: 20px; color: var(--fp-text); h1 { font-size: 22px; } a { color: var(--fp-link); text-decoration: none; } p, small { color: var(--fp-muted); overflow-wrap: anywhere; } [role=alert] p { color: #bd503c; } }
.medal-list { list-style: none; margin: 16px 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; li { background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: 10px; padding: 16px; min-width: 0; overflow-wrap: anywhere; } strong { color: var(--fp-title); } }
.medal-type { display: inline-block; padding: 2px 6px; margin-left: 8px; border-radius: 5px; background: var(--fp-hover); font-size: 12px; }
button { margin: 4px 6px 4px 0; padding: 7px 10px; border: 1px solid var(--fp-border); border-radius: 7px; background: var(--fp-card); color: var(--fp-text); cursor: pointer; &:disabled { opacity: .5; cursor: default; } }
.medal-pager { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
@media(max-width: 650px) { .medal-list { grid-template-columns: minmax(0, 1fr); } }
</style>
