<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getAuthContextVersion } from '@/api/http'
import { readBrawlSeason, type BrawlSeason } from '@/api/v3-pets'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'

const auth = useAuthStore()
const pets = usePetsStore()
const board = ref<BrawlSeason>()
const error = ref('')
const loading = ref(false)
const date = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeZone: 'Asia/Shanghai' })
let mounted = false
let controller: AbortController | undefined
let query: { season?: number; page: number } = { page: 1 }
let boundary = getAuthContextVersion()

async function load(season?: number, page = 1) {
  if (!mounted || !auth.isLoggedIn) return
  controller?.abort()
  const request = new AbortController()
  controller = request
  query = { season, page }
  loading.value = true
  error.value = ''
  try {
    const result = await readBrawlSeason(season, page, request.signal)
    if (!request.signal.aborted) board.value = result
  } catch (reason) {
    if (!request.signal.aborted) error.value = reason instanceof Error ? reason.message : '赛季排行读取失败'
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}

function refresh() {
  void load(query.season, query.page)
}

function claim() {
  if (!board.value || !board.value.settled || !board.value.mine.reward || board.value.mine.claimed ||
      loading.value || error.value || pets.busy || pets.pending || pets.offline) return
  void pets.executeBrawl({ kind: 'brawl-season-claim', season: board.value.season })
}

watch(() => pets.confirmedEvent, event => {
  if (event?.kind === 'brawl-season-claim' || (event?.kind === 'brawl-match' && query.season === undefined)) refresh()
})
watch([() => auth.accessToken, () => auth.account?.oId], ([token, owner], [, previous]) => {
  const context = getAuthContextVersion()
  if (token && owner === previous && boundary === context) return
  boundary = context
  controller?.abort()
  board.value = undefined
  error.value = ''
  loading.value = false
  query = { page: 1 }
  if (token) refresh()
}, { flush: 'sync' })
onMounted(() => { mounted = true; refresh() })
onUnmounted(() => { mounted = false; controller?.abort() })
</script>

<template>
  <section class="season-panel" :aria-busy="loading" aria-labelledby="brawl-season">
    <header class="season-heading">
      <div>
        <span class="eyebrow">赛季荣誉</span>
        <h2 id="brawl-season">赛季排行榜</h2>
      </div>
      <button type="button" :disabled="loading" @click="refresh">{{ loading ? '读取中…' : '刷新排名' }}</button>
    </header>
    <p v-if="error" class="notice" role="alert">{{ error }}</p>
    <p v-else-if="loading && !board" class="empty" role="status">正在读取赛季排行…</p>
    <template v-if="board">
      <div class="season-header">
        <div class="season-summary">
          <span class="season-mark" aria-hidden="true">S{{ board.season }}</span>
          <div>
            <div class="season-title"><h3>第 {{ board.season }} 赛季</h3><span class="state-badge">{{ board.settled ? '已结算' : board.season === board.current ? '进行中' : '正在结算' }}</span></div>
            <p class="secondary">{{ date.format(board.startsAt) }} — {{ date.format(board.endsAt) }} 零点</p>
          </div>
        </div>
        <nav class="season-actions" aria-label="选择赛季">
          <button type="button" :disabled="loading || board.season <= 1" @click="load(board.season - 1)">上一季</button>
          <button v-if="board.season !== board.current" type="button" :disabled="loading" @click="load()">返回当前赛季</button>
        </nav>
      </div>
      <div class="season-content">
        <div class="ranking-panel">
          <p v-if="!board.list.length" class="empty">{{ board.page > 1 ? '这一页暂无排名' : '本赛季暂无上榜玩家' }}</p>
          <div v-else class="table-region" role="region" aria-label="赛季排名明细" tabindex="0">
            <table>
              <thead>
                <tr><th scope="col">排名</th><th scope="col">玩家</th><th scope="col">评级</th><th scope="col">胜场</th><th scope="col">场次</th></tr>
              </thead>
              <tbody>
                <tr v-for="row in board.list" :key="row.rank" :class="{ mine: row.mine }">
                  <td><span class="rank" :class="{ podium: row.rank <= 3 }">{{ row.rank }}</span></td>
                  <th scope="row">
                    <RouterLink v-if="row.name" :to="`/member/${encodeURIComponent(row.name)}`">{{ row.nickname || row.name }}</RouterLink>
                    <span v-else>社区玩家</span>
                    <span v-if="row.mine" class="mine-label">我</span>
                  </th>
                  <td class="rating">{{ row.rating }}</td><td>{{ row.wins }}</td><td>{{ row.games }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <nav v-if="board.page > 1 || board.hasNext" class="season-actions page-actions" aria-label="赛季排行榜分页">
            <button type="button" :disabled="loading || board.page <= 1" @click="load(query.season, board.page - 1)">上一页</button>
            <span>第 {{ board.page }} 页</span>
            <button type="button" :disabled="loading || !board.hasNext" @click="load(query.season, board.page + 1)">下一页</button>
          </nav>
        </div>
        <aside class="my-standing" aria-label="我的赛季战绩">
          <div class="standing-heading"><h3>我的战绩</h3><span class="secondary">第 {{ board.season }} 赛季</span></div>
          <div class="my-rank"><span>当前排名</span><strong>{{ board.mine.rank ? `#${board.mine.rank}` : '暂未上榜' }}</strong></div>
          <dl class="standing-stats">
            <div><dt>评级</dt><dd>{{ board.mine.rating }}</dd></div>
            <div><dt>胜场</dt><dd>{{ board.mine.wins }}</dd></div>
            <div><dt>场次</dt><dd>{{ board.mine.games }}</dd></div>
          </dl>
          <div v-if="board.mine.rank === null" class="qualification">
            <p>上榜进度</p>
            <div><span>实装 PvP</span><strong>{{ board.mine.games }} / 10 场</strong></div>
            <div><span>不同对手</span><strong>{{ board.mine.opponents }} / 5 位</strong></div>
          </div>
          <div v-if="board.mine.reward" class="season-reward">
            <span class="secondary">赛季奖励</span>
            <p><strong>{{ board.mine.reward }}</strong> 历练材料</p>
            <button type="button" class="primary" :disabled="loading || !!error || board.mine.claimed || pets.busy || !!pets.pending || pets.offline"
              @click="claim">{{ board.mine.claimed ? `已领取 ${board.mine.reward} 历练材料` : `领取 ${board.mine.reward} 历练材料` }}</button>
          </div>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.season-panel { min-inline-size: 0; }
.season-heading, .season-header, .season-summary, .season-title, .season-actions, .standing-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.season-heading, .season-header, .standing-heading { justify-content: space-between; }
h2, h3, p, dl, dd { margin: 0; }
h2 { margin-block-start: 4px; font-size: 1.2rem; }
h3 { font-size: .95rem; }
.eyebrow { color: var(--fp-muted); font-size: .75rem; letter-spacing: .06em; }
.secondary { color: var(--fp-muted); font-size: .825rem; line-height: 1.6; }
.season-header { margin-block: 24px; padding: 16px; border: 1px solid var(--fp-border); border-radius: var(--fp-radius-lg, 10px); background: var(--fp-bg); }
.season-summary { flex-wrap: nowrap; min-inline-size: 0; }
.season-mark { display: grid; place-items: center; flex: none; inline-size: 46px; block-size: 46px; border-radius: 12px; color: var(--fp-primary-ink, var(--fp-primary)); background: var(--fp-primary-soft); font-weight: 750; font-size: 1.05rem; }
.season-title { gap: 8px; margin-block-end: 4px; }
.state-badge, .mine-label { border-radius: 5px; padding: 2px 7px; background: var(--fp-primary-soft); color: var(--fp-primary-ink, var(--fp-primary)); font-size: .7rem; font-weight: 600; }
.season-content { display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, 300px); gap: 24px; align-items: start; }
.ranking-panel { min-inline-size: 0; }
.table-region { overflow-x: auto; scrollbar-gutter: stable; }
table { inline-size: 100%; border-collapse: collapse; font-size: .875rem; text-align: start; }
th, td { text-align: start; padding: 13px 10px; border-block-end: 1px solid var(--fp-border); }
th[scope="row"] { font-weight: 550; overflow-wrap: anywhere; }
th[scope="col"] { color: var(--fp-muted); font-weight: 500; font-size: .75rem; }
th[scope="col"], td { white-space: nowrap; }
th[scope="row"] a { color: var(--fp-text); text-decoration: none; }
th[scope="row"] a:hover { color: var(--fp-primary-ink, var(--fp-primary)); }
.rank { display: inline-grid; place-items: center; min-inline-size: 26px; block-size: 26px; font-size: .8rem; font-weight: 650; color: var(--fp-muted); }
.rank.podium { border-radius: 6px; background: color-mix(in srgb, var(--fp-accent) 13%, transparent); color: var(--fp-accent); }
.rating { font-weight: 650; font-variant-numeric: tabular-nums; }
.mine { background: var(--fp-primary-soft); }
.mine-label { margin-inline-start: 6px; white-space: nowrap; }
.page-actions { justify-content: end; margin-block-start: 16px; font-size: .825rem; }
.my-standing { padding: 20px; border: 1px solid var(--fp-border); border-radius: var(--fp-radius-lg, 10px); }
.my-rank { display: grid; gap: 5px; margin-block: 22px; }
.my-rank > span { color: var(--fp-muted); font-size: .75rem; }
.my-rank > strong { font-size: 1.7rem; line-height: 1.2; letter-spacing: -.025em; }
.standing-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.standing-stats > div { display: flex; flex-direction: column-reverse; gap: 4px; }
.standing-stats dt { font-size: .75rem; color: var(--fp-muted); }
.standing-stats dd { font-size: 1.1rem; font-weight: 650; font-variant-numeric: tabular-nums; }
.qualification, .season-reward { border-block-start: 1px solid var(--fp-border); padding-block-start: 16px; margin-block-start: 20px; display: grid; gap: 10px; font-size: .8rem; }
.qualification p { font-weight: 600; }
.qualification > div { display: flex; justify-content: space-between; gap: 12px; color: var(--fp-muted); }
.qualification strong { font-weight: 500; color: var(--fp-text); }
.season-reward strong { font-size: 1.3rem; }
.empty { display: grid; place-content: center; min-block-size: 180px; padding: 24px; color: var(--fp-muted); text-align: center; font-size: .875rem; }
.notice { padding-block: 16px; }
button { min-block-size: 44px; padding: 8px 14px; border: 1px solid var(--fp-border); border-radius: var(--fp-radius-md, 8px); background: var(--fp-card); color: inherit; font: inherit; font-size: .825rem; transition: background .16s, border-color .16s; }
button:not(:disabled) { cursor: pointer; }
button:not(:disabled):hover { background: var(--fp-hover); border-color: var(--fp-primary); }
button.primary { background: var(--fp-primary-fill, var(--fp-primary)); border-color: var(--fp-primary-fill, var(--fp-primary)); color: var(--fp-on-primary, #fff); }
button.primary:not(:disabled):hover { background: var(--fp-primary-fill-hover, var(--fp-primary-hover)); }
button:disabled { opacity: .55; }
button:focus-visible, a:focus-visible, .table-region:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
@media (max-width: 760px) {
  .season-content { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .season-header { margin-block: 20px; padding: 12px; }
  .season-actions { gap: 8px; }
  th, td { padding: 12px 6px; }
  .my-standing { padding: 16px; }
}
@media (prefers-reduced-motion: reduce) { button { transition: none; } }
</style>
