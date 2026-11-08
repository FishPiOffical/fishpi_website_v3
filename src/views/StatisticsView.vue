<script setup lang="ts">
import { statisticFields } from '@/api/v3-statistics'
import { useStatistics } from '@/composables/useStatistics'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeStatisticsPayload } from '@/seo/payload'

usePageSeo(() => ({ title: '数据统计', path: '/statistic', description: '摸鱼派社区公开统计' }))
const { value, loading, error, read } = useStatistics(consumeStatisticsPayload())
</script>

<template>
  <main class="statistics-page fp-page fp-ui">
    <header>
      <h1 class="fp-page-title">数据统计</h1>
      <p>社区数据概览</p>
      <button class="fp-control" type="button" :disabled="loading" @click="read()">刷新统计</button>
    </header>
    <p class="fp-state" v-if="loading" role="status">正在读取统计…</p>
    <div v-else-if="error" class="statistics-error fp-state" role="alert">
      <p>{{ error }}</p><button class="fp-control" type="button" @click="read()">重试统计</button>
    </div>
    <dl v-else-if="value" class="statistics-grid" aria-label="社区公开统计">
      <div v-for="[key, label] in statisticFields" :key="key" class="statistic-item fp-card">
        <dt>{{ label }}</dt><dd>{{ value[key].toLocaleString('zh-CN') }}</dd>
      </div>
    </dl>
    <p v-else role="status">统计尚未读取。</p>
  </main>
</template>

<style scoped lang="scss">
.statistics-page {    }
header { margin-bottom: 20px; padding: 18px 20px; background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: var(--fp-panel-radius); box-shadow: var(--fp-card-shadow); h1 { margin: 0 0 6px; color: var(--fp-title); font-size: 22px; } p { margin: 0; color: var(--fp-muted); font-size: 13px; } > button { display: none; } }
.statistics-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 0; }
.statistic-item { min-width: 0; background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: var(--fp-panel-radius); box-shadow: var(--fp-card-shadow); padding: 20px; dt { color: var(--fp-muted); font-size: 13px; } dd { margin: 10px 0 0; font-size: 26px; font-weight: 600; color: var(--fp-title); overflow-wrap: anywhere; } }
.statistics-error { color: var(--fp-text); }
button { padding: 8px 14px; color: var(--fp-text); background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: 8px; cursor: pointer; &:disabled { cursor: wait; opacity: .6; } }
@media (max-width: 600px) { .statistics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } .statistic-item { padding: 14px; dd { font-size: 22px; } } }
</style>
