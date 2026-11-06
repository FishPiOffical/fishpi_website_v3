<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { rankingTitles, rankingSubTypes, type RankingType } from '@/api/v3-rankings'
import { useRankingBoard } from '@/composables/useRankingBoard'
import VipNickname from '@/components/user/VipNickname.vue'
const props = defineProps<{ type: RankingType; initial?: unknown; compact?: boolean }>()
const { value, p, subType, loading, error, read } = useRankingBoard(props.type, props.initial, props.compact)
const panel = ref<HTMLElement | null>(null)
let lastPage = 1, lastSubType = subType.value
watch(value, data => {
  if (!data) return
  const moved = lastPage !== data.p || lastSubType !== data.subType
  lastPage = data.p; lastSubType = data.subType
  if (moved && !props.compact) void nextTick(() => { if (value.value === data) panel.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) })
})
const choices = computed(() => props.type === 'evolve' ? rankingSubTypes.evolve : props.type === 'xiaoice' ? rankingSubTypes.xiaoice : [])
const metricLabels: Record<string, string> = { points: '积分', streak: '连续签到天数', minutes: '在线分钟', clickCount: '点击次数', count: '次数', amount: '赞助金额（元）', times: '重开次数', achievement: '成就', know: '知识', reset: '重置', days: '天数', currentKnow: '当前知识', currentDays: '当前天数', exp: '经验', dieTimes: '死亡次数', allExTimes: '历练次数', allBsTimes: '吐纳次数', ancestry: '出身', gongfa: '功法' }
function metricName(key: string) { if (key === 'points') return ['balance', 'consumption'].includes(props.type) ? '积分' : '得分'; if (key === 'count') return props.type === 'perfect' ? '优选文章数' : props.type === 'invite' ? '邀请次数' : '赞助次数'; if (props.type === 'evolve' && ['achievement', 'know', 'reset', 'days'].includes(key)) return '历史最高' + metricLabels[key]; return metricLabels[key] || key }
</script>

<template>
  <div ref="panel" class="ranking-board" :class="{ compact }" :aria-label="rankingTitles[type]">
    <div class="ranking-controls">
      <label v-if="choices.length">子榜单<select v-model="subType"><option v-for="[key, title] in choices" :key="key" :value="key">{{ title }}</option></select></label>
      <button type="button" :disabled="loading" @click="read()">刷新榜单</button>
    </div>
    <p v-if="loading" role="status">正在读取榜单…</p>
    <div v-else-if="error" role="alert"><p>{{ error }}</p><button type="button" @click="read()">重试榜单</button><button v-if="p > 1" type="button" @click="read(1)">返回第一页</button></div>
    <template v-else-if="value">
      <p class="ranking-note">本次榜单共 {{ value.total }} 条{{ compact ? '，预览前8条' : '' }}；范围为服务端现有榜单快照。</p>
      <p v-if="value.summary">赞助总金额 {{ value.summary.amount.toLocaleString('zh-CN') }} 元 · 支持运营 {{ value.summary.supportedDays.toLocaleString('zh-CN') }} 天</p>
      <ol class="ranking-rows">
        <li v-for="entry in value.list" :key="entry.rank" :value="entry.rank">
          <span class="ranking-number">{{ entry.rank }}</span>
          <RouterLink v-if="entry.user" :to="`/member/${encodeURIComponent(entry.user.userName)}`" class="ranking-user" :data-user-card="entry.user.userName">
            <img :src="entry.user.userAvatarURL || '/images/user-thumbnail.png'" alt="" loading="lazy" referrerpolicy="no-referrer" />
            <VipNickname :user-id="entry.user.id" :text="entry.user.userNickname || entry.user.userName" />
          </RouterLink>
          <a v-else-if="entry.link?.url" :href="entry.link.url" target="_blank" rel="noopener noreferrer">{{ entry.link.title }}</a>
          <span v-else-if="entry.link">{{ entry.link.title }}</span>
          <span v-if="compact" class="ranking-score">{{ entry.score.toLocaleString('zh-CN') }} {{ type === 'checkin' ? '天' : type === 'online' ? '分钟' : '' }}</span>
          <dl v-else class="ranking-metrics"><div v-for="(metric, key) in entry.metrics" :key="key"><dt>{{ metricName(String(key)) }}</dt><dd>{{ typeof metric === 'number' ? metric.toLocaleString('zh-CN') : metric }}</dd></div></dl>
        </li>
      </ol>
      <p v-if="!value.list.length">本页暂无排名记录。</p>
      <div v-if="!compact" class="ranking-pager">
        <button type="button" :disabled="p <= 1" @click="read(p - 1)">上一页榜单</button>
        <span>第 {{ p }} 页 / 共 {{ value.pageCount }} 页</span>
        <button type="button" :disabled="p >= value.pageCount" @click="read(p + 1)">下一页榜单</button>
      </div>
    </template>
    <p v-else role="status">榜单尚未读取。</p>
  </div>
</template>

<style scoped lang="scss">
.ranking-board { scroll-margin-top: 144px; }
.ranking-controls, .ranking-pager { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 12px 0; label { display: flex; gap: 8px; align-items: center; } }
button, select { border: 1px solid var(--fp-border); border-radius: 7px; background: var(--fp-card); color: var(--fp-text); padding: 7px 10px; cursor: pointer; &:disabled { opacity: .5; cursor: default; } }
.ranking-note { color: var(--fp-muted); font-size: 13px; }
.ranking-rows { list-style: none; margin: 0; padding: 0; li { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; border-bottom: 1px solid var(--fp-border); padding: 14px 0; } a { color: var(--fp-text); text-decoration: none; overflow-wrap: anywhere; } }
.ranking-number { min-width: 28px; color: var(--fp-muted); }
.ranking-user { display: flex; align-items: center; gap: 10px; flex: 1 1 180px; min-width: 0; img { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; } }
.ranking-metrics { display: flex; gap: 12px; flex-wrap: wrap; margin: 0; max-width: 100%; div { display: flex; flex-wrap: wrap; gap: 5px; } dt { color: var(--fp-muted); } dd { margin: 0; overflow-wrap: anywhere; } }
.compact {
  .ranking-controls, .ranking-note { display: none; }
  .ranking-rows li { gap: 8px; padding: 5px 6px; min-height: 30px; font-size: 13px; border-bottom: 0; border-radius: 4px; transition: background-color 0.15s ease; &:hover { background-color: var(--fp-hover); } }
  .ranking-number { min-width: 18px; font-size: 12px; font-variant-numeric: tabular-nums; }
  .ranking-user { flex: 1 1 80px; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; img { width: 20px; height: 20px; border-radius: 4px; flex-shrink: 0; } }
  .ranking-score { margin-left: auto; color: var(--fp-muted); font-size: 12px; background: var(--fp-hover); padding: 1px 6px; border-radius: 9px; flex-shrink: 0; }
}
</style>
