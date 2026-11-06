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
const catalog = [
  { key:'checkin', title:'连续签到', desc:'日积月累，每一天都算数', group:'activity', icon:'calendar' },
  { key:'online', title:'在线时长', desc:'看看谁是社区的常驻鱼油', group:'activity', icon:'clock' },
  { key:'balance', title:'积分财富', desc:'鱼丸积累，记录你的收获', group:'activity', icon:'wallet' },
  { key:'consumption', title:'积分支出', desc:'让积分流动，让社区热闹', group:'activity', icon:'chart' },
  { key:'perfect', title:'优质创作', desc:'用好内容赢得社区认可', group:'community', icon:'pen' },
  { key:'profession', title:'职业成长', desc:'各有所长，探索职业进阶', group:'community', icon:'star' },
  { key:'donate', title:'鱼排续命师', desc:'感谢每一份对摸鱼派的支持', group:'community', icon:'heart' },
  { key:'invite', title:'邀请成员', desc:'好社区，和朋友一起分享', group:'community', icon:'users' },
  { key:'links', title:'热门外链', desc:'发现鱼油们分享的精彩链接', group:'community', icon:'link' },
  { key:'xiaoice', title:'小冰修仙', desc:'漫漫修仙路，谁能更进一步', group:'games', icon:'star' },
  { key:'evolve', title:'进化 Evolve', desc:'从微小生命走向文明进化', group:'games', icon:'growth' },
  { key:'adr', title:'A Dark Room', desc:'小黑屋里的探索与冒险', group:'games', icon:'moon' },
  { key:'mofish', title:'摸鱼大闯关', desc:'挑战关卡，刷新最好成绩', group:'games', icon:'game' },
  { key:'smallmofish', title:'摸鱼小闯关', desc:'小小挑战，也有大大乐趣', group:'games', icon:'game' },
  { key:'lifeRestart', title:'人生重开', desc:'不同的选择，不同的人生', group:'games', icon:'restart' },
  { key:'emoji', title:'真假小黄脸', desc:'考验眼力，找到与众不同', group:'games', icon:'smile' },
]
const groups = [
  { key:'activity', title:'社区活跃', description:'在摸鱼派留下日常的足迹', number:'01' },
  { key:'community', title:'创作与贡献', description:'让社区变好的每一份力量', number:'02' },
  { key:'games', title:'游戏挑战', description:'工作间隙，来一点胜负欲', number:'03' },
]
const sections = groups.map(group=>({...group,items:catalog.filter(item=>item.group===group.key)}))
const selected = computed(()=>catalog.find(item=>item.key===route.path.split('/')[2]))
const iconPaths:Record<string,string> = {
 calendar:'M8 3v4m8-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 9h2m4 0h2m-8 3h2',
 clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
 wallet:'M4 7V5h14v3M4 8h16v12H4V8Zm12 4h4v4h-4v-4Z',
 chart:'M4 4v16h16M8 15v-4m5 4V7m5 8v-6',
 pen:'m5 15 10-10 4 4L9 19l-5 1 1-5Zm8-8 4 4',
 star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
 heart:'M12 20 4 12a5 5 0 0 1 8-6 5 5 0 0 1 8 6l-8 8Z',
 users:'M16 21v-3a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v3m18 0v-3a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4-4a4 4 0 0 1 0 8',
 link:'m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
 growth:'M12 21V10m0 5C5 15 4 10 4 6c5 0 8 3 8 7m0-2c0-5 3-8 8-8 0 5-3 8-8 8',
 moon:'M20 14a8 8 0 0 1-10-10 9 9 0 1 0 10 10Z',
 game:'M8 8h8c3 0 4 2 5 8 1 4-3 4-5 0H8c-2 4-6 4-5 0 1-6 2-8 5-8Zm-1 3v4m-2-2h4m7-1h.01m2 2h.01',
 restart:'M4 11a8 8 0 1 1 2 7M4 4v7h7',
 smile:'M8 9h.01M16 9h.01m-8 5c2 3 6 3 8 0m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
}
</script>
<template>
  <div class="top-page fp-page fp-page--wide fp-ui" :class="{'is-detail': kind || route.path === '/top/profession'}">
    <aside v-if="kind || route.path === '/top/profession'" class="ranking-sidebar" aria-label="排行榜分类">
      <RouterLink to="/top" class="back-catalog">← 全部榜单</RouterLink>
      <nav v-for="section in sections" :key="section.key" :aria-label="section.title">
        <h2>{{ section.title }}</h2>
        <RouterLink v-for="item in section.items" :key="item.key" :to="`/top/${item.key}`" :aria-current="selected?.key===item.key?'page':undefined">{{ item.title }}</RouterLink>
      </nav>
    </aside>
    <section v-if="kind" class="top-board">
      <header class="board-header">
        <RouterLink to="/top" class="breadcrumb">全部榜单</RouterLink><span aria-hidden="true"> / </span><span>{{ selected?.title }}</span>
        <h1 class="fp-page-title">{{ rankingTitles[kind] }}</h1>
        <p>每一份投入，都值得被看见。</p>
      </header>
      <RankingBoard :key="kind" :type="kind" :initial="initial" />
    </section>
    <section v-else-if="route.path === '/top/profession'" class="top-board"><ProfessionRanking /></section>
    <template v-else>
      <header class="catalog-hero">
        <div class="hero-copy">
          <span class="eyebrow">社区 · 荣誉 · 成长</span>
          <h1>摸鱼也有高光时刻<span class="hero-dot">。</span></h1>
          <p>在这里，看见坚持、分享与探索的力量。</p>
          <div class="hero-meta"><span>全部榜单</span><span class="meta-dot" aria-hidden="true">·</span><span>{{ catalog.length }} 个榜单，发现不同的出色</span></div>
        </div>
        <svg class="hero-art" viewBox="0 0 200 160" fill="none" aria-hidden="true">
          <circle cx="110" cy="75" r="64" fill="currentColor" opacity=".05"/>
          <path d="M76 36h68v37c0 22-15 36-34 36S76 95 76 73V36Z" fill="currentColor" opacity=".14"/>
          <path d="M76 47H56v14c0 18 10 27 28 27m60-41h20v14c0 18-10 27-28 27m-26 21v22m-22 5h44M76 36h68v37c0 22-15 36-34 36S76 95 76 73V36Z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="m110 52 4.5 9 10 1.5-7.2 7 1.7 10-9-4.7-9 4.7 1.7-10-7.2-7 10-1.5 4.5-9Z" fill="currentColor" opacity=".6"/>
          <path d="M42 26v10m-5-5h10m120 83v10m-5-5h10" stroke="currentColor" stroke-width="2" opacity=".5"/>
        </svg>
      </header>
      <section v-for="section in sections" :key="section.key" class="catalog-section" :data-group="section.key" :aria-labelledby="`group-${section.key}`">
        <header class="section-head">
          <span class="section-number" aria-hidden="true">{{ section.number }}</span>
          <div><h2 :id="`group-${section.key}`">{{ section.title }}</h2><p>{{ section.description }}</p></div>
          <span class="section-count">{{ section.items.length }} 个榜单</span>
        </header>
        <div class="catalog-grid">
          <RouterLink v-for="item in section.items" :key="item.key" :to="`/top/${item.key}`" class="catalog-item">
            <span class="item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="iconPaths[item.icon]" /></svg></span>
            <span class="item-copy"><span class="item-title">{{ item.title }}</span><span class="item-desc">{{ item.desc }}</span></span>
            <span class="item-arrow" aria-hidden="true">↗</span>
          </RouterLink>
        </div>
      </section>
    </template>
  </div>
</template>
<style scoped>
.top-page{padding-bottom:16px}
.catalog-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:30px 32px;margin-bottom:28px;border:1px solid var(--fp-border);border-radius:var(--fp-panel-radius);background:linear-gradient(115deg,var(--fp-card) 35%,var(--fp-primary-soft));overflow:hidden}
.eyebrow{font-size:12px;color:var(--fp-primary);font-weight:600;letter-spacing:2px}
.catalog-hero h1{font-size:30px;line-height:1.45;letter-spacing:-.8px;margin:10px 0 8px;color:var(--fp-title);font-weight:650}
.hero-dot{color:var(--fp-primary)}
.catalog-hero p{font-size:14px;line-height:1.7;color:var(--fp-muted);margin:0}
.hero-meta{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--fp-muted);margin-top:22px}
.hero-meta>span:first-child{color:var(--fp-text);font-weight:600}
.meta-dot{opacity:.5}.hero-art{width:200px;height:160px;flex:none;color:var(--fp-primary);margin-right:18px}
.catalog-section{margin-bottom:26px}
.section-head{display:flex;align-items:center;gap:12px;margin:0 0 12px;padding:0 2px}
.section-number{font-size:25px;line-height:1;font-weight:500;letter-spacing:-1px;color:var(--fp-muted);opacity:.42;font-variant-numeric:tabular-nums}
.section-head h2{font-size:17px;font-weight:600;color:var(--fp-title);margin:0 0 3px}
.section-head p{font-size:12px;color:var(--fp-muted);margin:0;line-height:1.5}
.section-count{margin-left:auto;font-size:12px;color:var(--fp-muted);white-space:nowrap}
.catalog-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.catalog-item{display:flex;align-items:center;gap:12px;min-width:0;padding:19px 18px;background:var(--fp-card);border:1px solid var(--fp-border);border-radius:var(--fp-panel-radius);color:var(--fp-text);text-decoration:none;transition:background-color .18s,border-color .18s,box-shadow .18s}
.catalog-item:hover{color:var(--fp-text);background:var(--fp-hover);border-color:color-mix(in srgb,var(--fp-primary) 35%,var(--fp-border));box-shadow:0 3px 10px rgb(0 0 0 / .03);text-decoration:none}
.catalog-item:hover .item-title{text-decoration:underline;text-underline-offset:4px}
.item-icon{display:grid;place-items:center;flex:none;width:38px;height:38px;background:var(--fp-primary-soft);color:var(--fp-primary);border-radius:10px}
.item-icon svg{width:21px;height:21px}
[data-group='community'] .item-icon{color:var(--fp-accent);background:color-mix(in srgb,var(--fp-accent) 9%,var(--fp-card))}
[data-group='games'] .item-icon{color:var(--fp-muted);background:var(--fp-surface-subtle)}
.item-copy{display:flex;flex-direction:column;gap:5px;min-width:0}
.item-title{font-size:14px;color:var(--fp-title);font-weight:600;line-height:1.5}
.item-desc{font-size:12px;color:var(--fp-muted);line-height:1.5}
.item-arrow{margin-left:auto;align-self:flex-start;font-size:16px;color:var(--fp-muted);opacity:.6}
.catalog-item:focus-visible,.ranking-sidebar a:focus-visible{outline:2px solid var(--fp-primary);outline-offset:3px}
.is-detail{display:grid;grid-template-columns:172px minmax(0,1fr);gap:20px;align-items:start}
.ranking-sidebar{position:sticky;top:calc(var(--fp-nav-h) + 14px);padding:12px;background:var(--fp-card);border:1px solid var(--fp-border);border-radius:var(--fp-panel-radius)}
.ranking-sidebar a{display:block;padding:7px 10px;font-size:13px;line-height:1.5;color:var(--fp-muted);text-decoration:none;border-radius:6px}
.ranking-sidebar a:hover{background:var(--fp-hover);text-decoration:underline;text-underline-offset:3px}
.ranking-sidebar .back-catalog{font-weight:600;color:var(--fp-text);padding-bottom:12px;border-bottom:1px solid var(--fp-border);border-radius:0;margin-bottom:12px}
.ranking-sidebar h2{font-size:11px;font-weight:500;color:var(--fp-muted);margin:14px 10px 5px}
.ranking-sidebar a[aria-current='page']{background:var(--fp-primary-soft);color:var(--fp-primary);font-weight:600}
.top-board{min-width:0;padding:22px;background:var(--fp-card);border:1px solid var(--fp-border);border-radius:var(--fp-panel-radius)}
.board-header{border-bottom:1px solid var(--fp-border);padding-bottom:16px;margin-bottom:16px;font-size:12px;color:var(--fp-muted)}
.breadcrumb{color:inherit}.board-header .fp-page-title{margin:12px 0 6px}.board-header p{margin:0;line-height:1.6}
@media(max-width:1000px){.catalog-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hero-art{margin-right:0;width:160px}}
@media(max-width:640px){.catalog-hero{padding:22px 20px;margin-bottom:22px;gap:0;position:relative}.hero-copy{position:relative;z-index:1}.catalog-hero h1{font-size:23px;letter-spacing:-.5px}.catalog-hero p{font-size:12px}.hero-meta{margin-top:16px;font-size:11px;gap:7px}.hero-art{position:absolute;right:-34px;top:12px;opacity:.25;width:155px;pointer-events:none}.catalog-grid{grid-template-columns:1fr;gap:8px}.catalog-item{padding:15px 16px}.catalog-section{margin-bottom:22px}.section-head h2{font-size:16px}.is-detail{display:block}.ranking-sidebar{position:static;display:flex;align-items:center;gap:12px;overflow-x:auto;margin-bottom:14px;scrollbar-width:thin}.ranking-sidebar nav{display:flex;gap:4px;flex:none}.ranking-sidebar h2{display:none}.ranking-sidebar a{white-space:nowrap;flex:none}.ranking-sidebar .back-catalog{margin:0;padding:7px 10px;border-bottom:0}.top-board{padding:16px}.item-desc{font-size:12px}}
@media(prefers-reduced-motion:reduce){.catalog-item{transition:none}}
</style>
