<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import type { PetActivityRewards } from '@/api/v3-pets'
import { usePetActivityHistoryStore } from '@/stores/petActivityHistory'
import { usePetsStore } from '@/stores/pets'
import { formatDateTime } from '@/utils/time'
import PetIcon from './PetIcon.vue'
import { petActivityLabels, petSkillNames } from './petActivityStatus'
import { usePetClock } from './usePetClock'

const history = usePetActivityHistoryStore(), pets = usePetsStore()
const { now } = usePetClock()
const filters = [{ id: 'all', name: '全部' }, { id: 'outing', name: '外出' }, { id: 'course', name: '学校' }, { id: 'work', name: '工作履历' }] as const
const errorText = computed(() => /JSON|HTTP|SQL|fetch|network|token|stack|接口|数据格式/i.test(history.error) ? '活动记录暂时无法读取，请稍后重试。' : history.error)
const pagination = computed(() => history.history?.pagination)
onBeforeUnmount(() => history.close())

function rewards(value: PetActivityRewards, showWorkIncome = false) {
  const result: string[] = []
  if (value.coins || showWorkIncome) result.push(`宠物币 +${value.coins}${showWorkIncome && value.coins === 0 ? '（当日额度已用完）' : ''}`)
  if (value.experience) result.push(`经验 +${value.experience}`)
  if (value.food) result.push(`口粮 +${value.food}`)
  if (value.mood) result.push(`心情 +${Number(value.mood.toFixed(2))}`)
  if (value.proficiency) result.push(`熟练度 +${value.proficiency}`)
  for (const skill of value.skills) result.push(`${pets.catalog?.skills.find(item => item.id === skill.id)?.name || petSkillNames[skill.id]} +${skill.experience}`)
  return result.length ? result.join(' · ') : '本次没有额外收益'
}
</script>

<template>
  <section class="pet-history" aria-labelledby="pet-history-title">
    <button class="history-toggle" type="button" :aria-expanded="history.opened" aria-controls="pet-history-content" @click="history.opened ? history.close() : history.open()">
      <PetIcon name="history" /><span><strong id="pet-history-title">活动记录</strong><small>外出、课程与工作中的每一次成长</small></span><PetIcon name="chevron" class="history-chevron" :class="{ expanded: history.opened }" />
    </button>
    <div v-if="history.opened" id="pet-history-content" class="history-content">
      <div class="history-toolbar"><div class="history-filters" aria-label="活动记录分类"><button v-for="filter in filters" :key="filter.id" type="button" :aria-pressed="history.filter === filter.id" @click="history.setFilter(filter.id)">{{ filter.name }}</button></div><button type="button" class="history-refresh" :disabled="history.loading" aria-label="刷新活动记录" title="刷新记录" @click="history.refresh()"><PetIcon name="refresh" /></button></div>
      <div v-if="errorText" class="history-error" role="alert"><span>{{ errorText }}</span><button type="button" class="history-refresh" :disabled="history.loading" aria-label="重新读取活动记录" title="重新读取" @click="history.refresh()"><PetIcon name="refresh" /></button></div>
      <p v-else-if="!history.history && history.loading" class="history-empty" role="status">正在读取活动记录…</p>
      <template v-else-if="history.history">
        <p v-if="!history.history.list.length" class="history-empty">还没有{{ history.filter === 'all' ? '' : history.filter === 'work' ? '工作' : history.filter === 'course' ? '课程' : '外出' }}记录，准备好后安排一次活动吧。</p>
        <ol v-else class="history-list" :aria-busy="history.loading">
          <li v-for="item in history.history.list" :key="item.id" class="history-item">
            <div class="history-kind"><PetIcon :name="item.kind" /></div>
            <div class="history-record"><header><div><span>{{ petActivityLabels[item.kind] }}</span><h3>{{ item.name }}</h3></div><span class="history-status" :class="item.status === 'claimed' ? 'claimed' : item.endsAt <= now || item.status === 'claimable' ? 'claimable' : 'running'">{{ item.status === 'claimed' ? '已领取' : item.endsAt <= now || item.status === 'claimable' ? '待领取' : '进行中' }}</span></header>
              <div class="history-times"><span>开始 <time>{{ formatDateTime(item.startedAt) }}</time></span><span>{{ item.status === 'claimed' ? '领取' : '结束' }} <time>{{ formatDateTime(item.status === 'claimed' ? item.claimedAt : item.endsAt) }}</time></span></div>
              <p class="history-cost"><span>已投入</span>{{ item.cost.coins }} 宠物币 · 精力 {{ item.cost.energy }} · 饱食 {{ item.cost.hunger }} · 水分 {{ item.cost.water }}</p>
              <p v-if="item.status === 'claimed' && !item.actualRewards" class="history-old">早期记录未保存成果明细</p>
              <p v-else class="history-rewards" :class="{ actual: item.status === 'claimed' }"><span>{{ item.status === 'claimed' ? '实际获得' : '预计收获' }}</span>{{ rewards(item.actualRewards ?? item.rewards, item.kind === 'work' && item.status === 'claimed') }}</p>
            </div>
          </li>
        </ol>
        <nav v-if="pagination && pagination.pageCount > 1" class="history-pagination" aria-label="活动记录分页"><span>第 {{ pagination.page }} / {{ pagination.pageCount }} 页</span><div><button type="button" :disabled="history.loading || pagination.page <= 1" @click="history.setPage(pagination.page - 1)">上一页</button><button type="button" :disabled="history.loading || pagination.page >= pagination.pageCount" @click="history.setPage(pagination.page + 1)">下一页</button></div></nav>
      </template>
    </div>
  </section>
</template>

<style scoped>
.pet-history { margin-top: 20px; border: 1px solid var(--fp-border); border-radius: var(--fp-panel-radius, 14px); background: var(--fp-card); color: var(--fp-text); overflow: hidden; }
.history-toggle { display: flex; align-items: center; gap: 12px; width: 100%; padding: 22px 24px; border: 0; background: transparent; color: inherit; text-align: left; font: inherit; cursor: pointer; }.history-toggle > svg:first-child { width: 22px; height: 22px; color: var(--fp-muted); }.history-toggle > span { display: flex; flex: 1; flex-direction: column; min-width: 0; gap: 5px; }.history-toggle strong { color: var(--fp-title); font-size: 15px; }.history-toggle small { color: var(--fp-muted); font-size: 12px; line-height: 1.5; }.history-chevron { width: 16px; height: 16px; color: var(--fp-muted); transition: transform .18s ease; }.history-chevron.expanded { transform: rotate(90deg); }.history-toggle:hover { background: var(--fp-hover); }
.history-content { padding: 0 24px 20px; }.history-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--fp-border); padding-top: 16px; }.history-filters { display: flex; flex-wrap: wrap; gap: 6px; }.history-filters button { min-height: 36px; padding: 7px 13px; border: 1px solid transparent; border-radius: 7px; font: inherit; font-size: 12px; color: var(--fp-muted); background: transparent; cursor: pointer; }.history-filters button[aria-pressed=true] { border-color: var(--fp-border); color: var(--fp-primary); background: var(--fp-primary-soft); }.history-refresh { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; flex: none; border: 1px solid var(--fp-border); border-radius: 8px; background: var(--fp-card); color: var(--fp-muted); cursor: pointer; }.history-refresh svg { width: 17px; height: 17px; }
.history-empty { margin: 0; padding: 30px 12px; color: var(--fp-muted); text-align: center; font-size: 13px; line-height: 1.8; }.history-error { display: flex; align-items: center; gap: 12px; padding: 16px 0 0; color: var(--fp-muted); font-size: 13px; }.history-error > span { flex: 1; }
.history-list { list-style: none; padding: 0; margin: 8px 0 0; }.history-item { display: flex; align-items: flex-start; gap: 12px; padding: 20px 0; border-bottom: 1px solid var(--fp-border); }.history-item:last-child { border-bottom: 0; }.history-kind { display: grid; place-items: center; width: 34px; height: 34px; flex: none; border-radius: 9px; color: var(--fp-muted); background: var(--fp-bg); }.history-kind svg { width: 17px; height: 17px; }.history-record { flex: 1; min-width: 0; }.history-record > header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 8px; }.history-record header > div { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }.history-record header > div > span { color: var(--fp-muted); font-size: 11px; }.history-record h3 { margin: 0; color: var(--fp-title); font-size: 14px; overflow-wrap: anywhere; }.history-status { padding: 3px 7px; border-radius: 5px; font-size: 11px; white-space: nowrap; }.history-status.running { color: var(--fp-muted); background: var(--fp-bg); }.history-status.claimable { color: var(--fp-accent); background: var(--fp-hover); }.history-status.claimed { color: var(--fp-primary); background: var(--fp-primary-soft); }
.history-times { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 9px 0; color: var(--fp-muted); font-size: 11px; line-height: 1.7; }.history-times time { font-variant-numeric: tabular-nums; }.history-cost, .history-rewards, .history-old { margin: 5px 0 0; color: var(--fp-muted); font-size: 11px; line-height: 1.9; overflow-wrap: anywhere; }.history-cost > span, .history-rewards > span { margin-right: 10px; }.history-rewards.actual { color: var(--fp-primary); }.history-rewards.actual > span { color: var(--fp-muted); }
.history-pagination { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; border-top: 1px solid var(--fp-border); padding-top: 16px; font-size: 12px; color: var(--fp-muted); }.history-pagination > div { display: flex; gap: 6px; }.history-pagination button { min-height: 36px; padding: 7px 11px; border: 1px solid var(--fp-border); border-radius: 7px; color: var(--fp-text); background: var(--fp-card); font: inherit; cursor: pointer; }
button:disabled { opacity: .45; cursor: default; }button:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
@media (max-width: 600px) { .history-toggle { padding: 20px; }.history-content { padding: 0 20px 16px; }.history-times { flex-direction: column; }.history-item { gap: 10px; }.history-kind { width: 28px; height: 28px; border-radius: 7px; }.history-filters button { min-height: 44px; }.history-pagination button { min-height: 44px; } }
@media (max-width: 390px) { .history-toggle { padding: 18px 16px; }.history-content { padding-inline: 16px; }.history-toggle small { font-size: 11px; }.history-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); flex: 1; }.history-toolbar { align-items: flex-start; }.history-refresh { margin-top: 5px; }.history-kind { display: none; }.history-pagination > div { flex: 1; }.history-pagination button { flex: 1; } }
@media (prefers-reduced-motion: reduce) { .history-chevron { transition: none; } }
</style>
