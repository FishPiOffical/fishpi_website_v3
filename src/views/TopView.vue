<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { rankingTitles, type RankingType } from '@/api/v3-rankings'
import { consumeRankingPayload } from '@/seo/payload'
import { usePageSeo } from '@/composables/usePageSeo'
import RankingBoard from '@/components/RankingBoard.vue'
import ProfessionRanking from '@/components/profession/ProfessionRanking.vue'
const route = useRoute()
const kind = computed(() => { const key = route.path.split('/')[2]; return key && Object.hasOwn(rankingTitles, key) ? key as RankingType : null })
const initial = ref(consumeRankingPayload())
onMounted(() => { initial.value = null })
usePageSeo(() => ({ title: kind.value ? rankingTitles[kind.value] : route.path === '/top/profession' ? '职业排行' : '总榜', path: route.path, description: '摸鱼派社区公开排行榜' }))
const topCatalog = [
  {
    to: '/top/checkin',
    icon: '♣',
    title: '签到排行',
    desc: '公司打卡是生存，摸鱼才是生活',
    badge: '连签',
    color: '#60b044',
  },
  {
    to: '/top/online',
    icon: '♦',
    title: '在线时间排行',
    desc: '摸鱼总统山，挂机时长大比拼',
    badge: '在线',
    color: '#e59230',
  },
  {
    to: '/top/balance',
    icon: '♠',
    title: '积分财富排行',
    desc: '有钱人的世界我不懂，鱼丸储蓄大亨',
    badge: '财富',
    color: '#f39c12',
  },
  {
    to: '/top/consumption',
    icon: '♥',
    title: '积分支出排行',
    desc: '今晚的消费由公子买单，豪气冲天',
    badge: '消费',
    color: '#e74c3c',
  },
  {
    to: '/top/donate',
    icon: '💰',
    title: '鱼排续命师',
    desc: '摸鱼派续命师资助排行榜，感谢老板们支持！',
    badge: '续命',
    color: '#1abc9c',
  },
  {
    to: '/top/profession',
    icon: '✦',
    title: '职业排行',
    desc: '查看各职业公开进度与等级进阶',
    badge: '职业',
    color: '#3498db',
  },
  {
    to: '/top/perfect',
    icon: '👍',
    title: '优选排行',
    desc: '摸鱼派大佬优质内容产出排名，抱紧大腿！',
    badge: '优选',
    color: '#9b59b6',
  },
  {
    to: '/top/invite',
    icon: '🤝',
    title: '邀请成员排行',
    desc: '感谢你们对摸鱼派社区的杰出贡献',
    badge: '邀请',
    color: '#e67e22',
  },
  {
    to: '/top/xiaoice',
    icon: '🧊',
    title: '小冰游戏排行',
    desc: '看看修仙路上是谁最肝',
    badge: '游戏',
    color: '#00cec9',
  },
  {
    to: '/top/evolve',
    icon: '🧬',
    title: '进化排行榜',
    desc: '进化-Evolve 游戏文明进化排名',
    badge: '游戏',
    color: '#27ae60',
  },
  {
    to: '/top/adr',
    icon: '🕯️',
    title: 'A Dark Room 排行',
    desc: '通过 ADR 游戏的小黑屋玩家总分排名',
    badge: '游戏',
    color: '#34495e',
  },
  {
    to: '/top/mofish',
    icon: '🐟',
    title: '摸鱼大闯关排行',
    desc: '摸鱼大闯关玩家闯关数排名',
    badge: '游戏',
    color: '#2980b9',
  },
  {
    to: '/top/smallmofish',
    icon: '🐠',
    title: '摸鱼小闯关排行',
    desc: '摸鱼小闯关玩家闯关数排名',
    badge: '游戏',
    color: '#16a085',
  },
  {
    to: '/top/lifeRestart',
    icon: '🔄',
    title: '人生重开模拟器排行',
    desc: '人生重开模拟器成就与天赋排名',
    badge: '游戏',
    color: '#d35400',
  },
  {
    to: '/top/emoji',
    icon: '😘',
    title: 'Emoji 真假小黄脸排行',
    desc: 'Emoji 真假小黄脸游戏成绩排名',
    badge: '游戏',
    color: '#f1c40f',
  },
]

const navIcons: Record<string, string> = {
  checkin: '♣',
  online: '♦',
  balance: '♠',
  consumption: '♥',
  donate: '💰',
  perfect: '👍',
  invite: '🤝',
  links: '🔗',
  xiaoice: '🧊',
  evolve: '🧬',
  adr: '🕯️',
  mofish: '🐟',
  smallmofish: '🐠',
  lifeRestart: '🔄',
  emoji: '😘',
}
</script>
<template>
  <div class="top-page fp-page fp-page--wide fp-ui">
    <nav class="top-nav fp-tabs" aria-label="排行榜分类">
      <RouterLink to="/top" class="top-nav-item"><span class="nav-icon">🏅</span><span>全部榜单</span></RouterLink>
      <RouterLink v-for="(title, key) in rankingTitles" :key="key" :to="`/top/${key}`" class="top-nav-item">
        <span class="nav-icon">{{ navIcons[key] || '•' }}</span><span>{{ title }}</span>
      </RouterLink>
      <RouterLink to="/top/profession" class="top-nav-item"><span class="nav-icon">✦</span><span>职业排行</span></RouterLink>
    </nav>
    <section v-if="kind" class="top-board fp-card">
      <header class="board-header">
        <span class="board-header-icon">{{ navIcons[kind] || '🏆' }}</span>
        <div class="board-header-copy">
          <h1 class="fp-page-title">{{ rankingTitles[kind] }}</h1>
          <p class="board-header-sub">摸鱼派社区实时公开荣誉与数据排行</p>
        </div>
      </header>
      <RankingBoard :key="kind" :type="kind" :initial="initial" />
    </section>
    <section v-else-if="route.path === '/top/profession'" class="top-board fp-card"><ProfessionRanking /></section>
    <template v-else>
      <section class="catalog-hero fp-card">
        <div class="catalog-hero-head">
          <div>
            <h1 class="fp-page-title">全部榜单</h1>
            <p class="catalog-hero-sub">汇总摸鱼派活跃、财富、创作、资助与小游戏荣誉排行榜</p>
          </div>
          <span class="catalog-count-pill">共 {{ topCatalog.length + 1 }} 个榜单</span>
        </div>
        <div class="top-catalog">
          <RouterLink v-for="item in topCatalog" :key="item.to" :to="item.to" class="catalog-item">
            <div class="card-icon-col" :style="{ backgroundColor: item.color + '18', color: item.color }">
              <span class="catalog-icon">{{ item.icon }}</span>
            </div>
            <div class="card-content">
              <div class="card-title-row">
                <span class="catalog-title">{{ item.icon }} {{ item.title }}</span>
                <span class="catalog-tag" :style="{ backgroundColor: item.color + '18', color: item.color }">{{ item.badge }}</span>
              </div>
              <p class="catalog-desc">{{ item.desc }}</p>
            </div>
          </RouterLink>
          <RouterLink to="/top/links" class="catalog-item">
            <div class="card-icon-col" style="background-color: rgba(22, 160, 133, 0.1); color: #16a085">
              <span class="catalog-icon">🔗</span>
            </div>
            <div class="card-content">
              <div class="card-title-row">
                <span class="catalog-title">链接点击排行</span>
                <span class="catalog-tag" style="background-color: rgba(22, 160, 133, 0.1); color: #16a085">外链</span>
              </div>
              <p class="catalog-desc">社区热门外链分享与点击统计排行</p>
            </div>
          </RouterLink>
        </div>
      </section>
    </template>
  </div>
</template>
<style scoped lang="scss">
.top-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  padding: 8px 10px;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
  box-shadow: var(--fp-card-shadow);

  .top-nav-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--fp-text);
    text-decoration: none;
    transition: all 0.16s ease;

    .nav-icon {
      font-size: 13px;
      line-height: 1;
      opacity: 0.85;
    }

    &:hover {
      background: var(--fp-hover);
      color: var(--fp-title);
    }

    &.router-link-exact-active {
      background: color-mix(in srgb, var(--fp-accent) 14%, var(--fp-card));
      color: var(--fp-accent, #68a84f);
      font-weight: 600;
    }
  }
}

.top-board,
.catalog-hero {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
  box-shadow: var(--fp-card-shadow);
  padding: 22px 24px;
}

.board-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--fp-divider);

  .board-header-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--fp-accent) 12%, var(--fp-surface-subtle));
    color: var(--fp-accent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  }

  .board-header-copy {
    min-width: 0;

    h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: var(--fp-title);
    }

    .board-header-sub {
      margin: 3px 0 0;
      font-size: 12px;
      color: var(--fp-muted);
    }
  }
}

.catalog-hero-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--fp-divider);

  h1 {
    margin: 0;
    font-size: 19px;
    font-weight: 700;
    color: var(--fp-title);
  }

  .catalog-hero-sub {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--fp-muted);
  }

  .catalog-count-pill {
    font-size: 12px;
    font-weight: 600;
    color: var(--fp-muted);
    background: var(--fp-surface-subtle);
    border: 1px solid var(--fp-divider);
    padding: 4px 10px;
    border-radius: 999px;
    white-space: nowrap;
  }
}

.top-catalog {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 14px;
}

.catalog-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: var(--fp-surface-subtle);
  border: 1px solid var(--fp-divider);
  border-radius: 12px;
  padding: 16px;
  color: var(--fp-title);
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover {
    background: var(--fp-card);
    border-color: color-mix(in srgb, var(--fp-accent) 45%, var(--fp-border));
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
  }

  .card-icon-col {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .catalog-icon {
      font-size: 21px;
      line-height: 1;
    }
  }

  .card-content {
    flex: 1;
    min-width: 0;
  }

  .card-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 5px;
  }

  .catalog-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--fp-title);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .catalog-tag {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .catalog-desc {
    margin: 0;
    color: var(--fp-muted);
    font-size: 12.5px;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

@media (max-width: 650px) {
  .top-catalog {
    grid-template-columns: minmax(0, 1fr);
  }
  .top-board,
  .catalog-hero {
    padding: 14px;
  }
}
</style>
