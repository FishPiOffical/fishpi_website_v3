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

</script>
<template>
  <div class="top-page">
    <nav class="top-nav" aria-label="排行榜分类"><RouterLink to="/top">全部榜单</RouterLink><RouterLink v-for="(title, key) in rankingTitles" :key="key" :to="`/top/${key}`">{{ title }}</RouterLink><RouterLink to="/top/profession">职业排行</RouterLink></nav>
    <section v-if="kind" class="top-board"><h1>{{ rankingTitles[kind] }}</h1><RankingBoard :key="kind" :type="kind" :initial="initial" /></section>
    <section v-else-if="route.path === '/top/profession'" class="top-board"><ProfessionRanking /></section>
    <template v-else><h1>全部榜单</h1><div class="top-catalog"><RouterLink v-for="item in topCatalog" :key="item.to" :to="item.to" class="catalog-item"><span>{{ item.icon }} {{ item.title }}</span><p>{{ item.desc }}</p></RouterLink><RouterLink to="/top/links" class="catalog-item">链接点击排行</RouterLink></div></template>
  </div>
</template>
<style scoped lang="scss">
.top-page { max-width: 1150px; margin: 0 auto; padding: 24px 16px; }
.top-nav { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; a { color: var(--fp-text); text-decoration: none; } .router-link-exact-active { color: var(--fp-accent, #68a84f); } }
.top-board { background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: 12px; padding: 20px; h1 { margin-top: 0; color: var(--fp-title); } }
.top-catalog { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.catalog-item { display: block; background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: 12px; padding: 20px; color: var(--fp-title); text-decoration: none; p { color: var(--fp-muted); font-size: 13px; } }
@media (max-width: 650px) { .top-catalog { grid-template-columns: minmax(0, 1fr); } .top-board { padding: 14px; } }
</style>
