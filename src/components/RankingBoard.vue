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
    <div class="ranking-controls" :class="{ 'has-choices': choices.length > 0 }">
      <label v-if="choices.length" class="subtype-filter">
        <span class="subtype-label">子榜单</span>
        <select v-model="subType">
          <option v-for="[key, title] in choices" :key="key" :value="key">{{ title }}</option>
        </select>
      </label>
      <button type="button" class="refresh-board-btn" :disabled="loading" @click="read()">刷新榜单</button>
    </div>
    <p v-if="loading" role="status" class="ranking-status">正在读取榜单…</p>
    <div v-else-if="error" role="alert" class="ranking-error">
      <p>{{ error }}</p>
      <div class="ranking-error-actions">
        <button type="button" @click="read()">重试榜单</button>
        <button v-if="p > 1" type="button" @click="read(1)">返回第一页</button>
      </div>
    </div>
    <template v-else-if="value">
      <div class="ranking-meta-bar">
        <p class="ranking-note">本次榜单共 {{ value.total }} 条{{ compact ? '，预览前8条' : '' }}；范围为服务端现有榜单快照。</p>
        <p v-if="value.summary" class="ranking-summary-badge">
          💰 赞助总金额 {{ value.summary.amount.toLocaleString('zh-CN') }} 元 · 支持运营 {{ value.summary.supportedDays.toLocaleString('zh-CN') }} 天
        </p>
      </div>
      <ol class="ranking-rows">
        <li v-for="entry in value.list" :key="entry.rank" :value="entry.rank" :data-rank="entry.rank">
          <span class="ranking-number" :data-rank="entry.rank">{{ entry.rank }}</span>
          <RouterLink v-if="entry.user" :to="`/member/${encodeURIComponent(entry.user.userName)}`" class="ranking-user" :data-user-card="entry.user.userName">
            <img :src="entry.user.userAvatarURL || '/images/user-thumbnail.png'" alt="" loading="lazy" referrerpolicy="no-referrer" />
            <span class="ranking-user-info">
              <VipNickname :user-id="entry.user.id" :text="entry.user.userNickname || entry.user.userName" />
              <small v-if="!compact && entry.user.userNickname && entry.user.userNickname !== entry.user.userName" class="ranking-handle">@{{ entry.user.userName }}</small>
            </span>
          </RouterLink>
          <a v-else-if="entry.link?.url" :href="entry.link.url" target="_blank" rel="noopener noreferrer" class="ranking-link">{{ entry.link.title }}</a>
          <span v-else-if="entry.link" class="ranking-link">{{ entry.link.title }}</span>
          <span v-if="compact" class="ranking-score">{{ entry.score.toLocaleString('zh-CN') }} {{ type === 'checkin' ? '天' : type === 'online' ? '分钟' : '' }}</span>
          <dl v-else class="ranking-metrics">
            <div v-for="(metric, key) in entry.metrics" :key="key" class="metric-pill">
              <dt>{{ metricName(String(key)) }}</dt>
              <dd>{{ typeof metric === 'number' ? metric.toLocaleString('zh-CN') : metric }}</dd>
            </div>
          </dl>
        </li>
      </ol>
      <p v-if="!value.list.length" class="ranking-empty">本页暂无排名记录。</p>
      <div v-if="!compact" class="ranking-pager">
        <button type="button" :disabled="p <= 1" @click="read(p - 1)">上一页榜单</button>
        <span class="pager-status">第 {{ p }} 页 / 共 {{ value.pageCount }} 页</span>
        <button type="button" :disabled="p >= value.pageCount" @click="read(p + 1)">下一页榜单</button>
      </div>
    </template>
    <p v-else role="status" class="ranking-status">榜单尚未读取。</p>
  </div>
</template>

<style scoped lang="scss">
.ranking-board {
  scroll-margin-top: 144px;
}

.ranking-controls {
  display: none;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin: 0 0 12px;

  &.has-choices {
    display: flex;
  }

  .subtype-filter {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    font-weight: 600;
    color: var(--fp-muted);
  }
}

.refresh-board-btn {
  display: none !important;
}

button,
select {
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-card);
  color: var(--fp-text);
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.16s ease;

  &:hover:not(:disabled) {
    border-color: var(--fp-accent);
    color: var(--fp-title);
  }

  &:disabled {
    opacity: 0.48;
    cursor: default;
  }
}

.ranking-meta-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.ranking-note {
  margin: 0;
  color: var(--fp-muted);
  font-size: 12.5px;
}

.ranking-summary-badge {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #16a085;
  background: rgba(26, 188, 156, 0.1);
  border: 1px solid rgba(26, 188, 156, 0.24);
  padding: 5px 12px;
  border-radius: 999px;
}

.ranking-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;

  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px;
    background: var(--fp-surface-subtle);
    border: 1px solid var(--fp-divider);
    border-radius: 10px;
    padding: 10px 14px;
    transition: background-color 0.16s ease, border-color 0.16s ease, transform 0.16s ease;

    &:hover {
      background: var(--fp-hover);
      border-color: var(--fp-border);
    }

    &[data-rank='1'] {
      background: linear-gradient(90deg, rgba(241, 196, 15, 0.09), var(--fp-surface-subtle) 55%);
      border-color: rgba(241, 196, 15, 0.32);
    }

    &[data-rank='2'] {
      background: linear-gradient(90deg, rgba(149, 165, 166, 0.09), var(--fp-surface-subtle) 55%);
      border-color: rgba(149, 165, 166, 0.3);
    }

    &[data-rank='3'] {
      background: linear-gradient(90deg, rgba(230, 126, 34, 0.09), var(--fp-surface-subtle) 55%);
      border-color: rgba(230, 126, 34, 0.3);
    }
  }

  a {
    color: var(--fp-text);
    text-decoration: none;
    overflow-wrap: anywhere;
  }
}

.ranking-number {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: var(--fp-card);
  border: 1px solid var(--fp-divider);
  color: var(--fp-muted);
  flex-shrink: 0;

  &[data-rank='1'] {
    background: linear-gradient(135deg, #f1c40f, #f39c12);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 2px 6px rgba(243, 156, 18, 0.32);
  }

  &[data-rank='2'] {
    background: linear-gradient(135deg, #bdc3c7, #95a5a6);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 2px 6px rgba(149, 165, 166, 0.28);
  }

  &[data-rank='3'] {
    background: linear-gradient(135deg, #e67e22, #d35400);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 2px 6px rgba(211, 84, 0, 0.28);
  }
}

.ranking-user {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1 1 200px;
  min-width: 0;

  img {
    width: 40px;
    height: 40px;
    border-radius: var(--fp-avatar-radius);
    object-fit: cover;
    border: 1px solid var(--fp-divider);
    flex-shrink: 0;
  }

  .ranking-user-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    font-weight: 600;
    color: var(--fp-title);
  }

  .ranking-handle {
    font-size: 11.5px;
    font-weight: 400;
    color: var(--fp-muted);
  }
}

.ranking-link {
  flex: 1 1 220px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--fp-title);

  &:hover {
    color: var(--fp-accent);
  }
}

.ranking-metrics {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0 0 0 auto;
  max-width: 100%;

  .metric-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--fp-card);
    border: 1px solid var(--fp-divider);
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 12.5px;
  }

  dt {
    color: var(--fp-muted);
    font-weight: 500;
  }

  dd {
    margin: 0;
    font-weight: 700;
    color: var(--fp-title);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
}

.ranking-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 18px 0 4px;
  padding-top: 12px;
  border-top: 1px solid var(--fp-divider);

  .pager-status {
    font-size: 13px;
    color: var(--fp-muted);
    font-variant-numeric: tabular-nums;
  }
}

.ranking-status,
.ranking-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--fp-muted);
  font-size: 13px;
}

.ranking-error {
  padding: 16px;
  border-radius: 10px;
  background: rgba(195, 74, 54, 0.08);
  border: 1px solid rgba(195, 74, 54, 0.25);
  color: var(--fp-danger, #c34a36);

  p {
    margin: 0 0 10px;
  }

  .ranking-error-actions {
    display: flex;
    gap: 8px;
  }
}

.compact {
  .ranking-controls,
  .ranking-meta-bar {
    display: none;
  }

  .ranking-rows {
    gap: 2px;

    li {
      gap: 8px;
      padding: 5px 6px;
      min-height: 30px;
      font-size: 13px;
      background: transparent;
      border: 0;
      border-radius: 6px;

      &:hover {
        background-color: var(--fp-hover);
      }
    }
  }

  .ranking-number {
    width: 20px;
    height: 20px;
    min-width: 20px;
    border-radius: 5px;
    font-size: 11.5px;
    box-shadow: none;
  }

  .ranking-user {
    flex: 1 1 80px;
    gap: 7px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    img {
      width: 20px;
      height: 20px;
      border-radius: var(--fp-avatar-radius);
      flex-shrink: 0;
    }

    .ranking-user-info {
      flex-direction: row;
      align-items: center;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .ranking-score {
    margin-left: auto;
    color: var(--fp-muted);
    font-size: 12px;
    background: var(--fp-hover);
    padding: 1px 6px;
    border-radius: 9px;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
}
</style>
