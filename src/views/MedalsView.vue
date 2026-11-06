<script setup lang="ts">
import { formatDateTime } from '@/utils/time'

import { computed, nextTick, ref, watch } from 'vue'
import V3MedalImage from '@/components/medal/V3MedalImage.vue'
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
  <section ref="panel" class="public-medals fp-page fp-ui">
    <h1 class="fp-page-title"><RouterLink :to="`/member/${encodeURIComponent(userName)}`">{{ userName }}</RouterLink> 的公开勋章</h1>
    <p>仅展示当前公开且有效的勋章。</p>
    <button class="fp-control" type="button" :disabled="loading" @click="read()">刷新公开勋章</button>
    <p v-if="loading" role="status">正在读取公开勋章…</p>
    <div v-else-if="error" role="alert"><p>{{ error }}</p><button class="fp-control" type="button" @click="read()">重试公开勋章</button><button class="fp-control" v-if="p > 1" type="button" @click="read(1)">返回第一页</button></div>
    <template v-else-if="value">
      <p>共 {{ value.total }} 枚公开勋章</p>
      <ul class="medal-list"><li v-for="(medal, i) in value.list" :key="`${p}:${i}:${medal.id}`"><V3MedalImage :id="medal.id" :name="medal.name" :user-name="userName" /><strong>{{ medal.name }}</strong><span v-if="medal.type" class="medal-type">{{ medal.type }}</span><p>{{ medal.description }}</p><small>{{ medal.expiresAt === 0 ? '永久有效' : `有效至 ${formatDateTime(medal.expiresAt)}` }}</small></li></ul>
      <p v-if="!value.list.length">本页没有公开勋章。</p>
      <div class="medal-pager fp-pagination"><button class="fp-control" type="button" :disabled="p <= 1" @click="read(p - 1)">上一页勋章</button><span>第 {{ p }} 页 / 共 {{ value.pageCount }} 页</span><button class="fp-control" type="button" :disabled="p >= value.pageCount" @click="read(p + 1)">下一页勋章</button></div>
    </template>
    <p v-else role="status">公开勋章尚未读取。</p>
  </section>
</template>
<style scoped lang="scss" src="../components/medal/public-medals.scss"></style>
