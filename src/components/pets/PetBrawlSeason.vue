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
  <div :aria-busy="loading">
    <div class="season-heading">
      <h2 id="brawl-season">赛季排行榜</h2>
      <button type="button" :disabled="loading" @click="refresh">刷新</button>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-else-if="loading && !board" role="status">正在读取赛季排行…</p>
    <template v-if="board">
      <div class="season-header">
        <div>
          <h3>第 {{ board.season }} 赛季</h3>
          <p class="secondary">{{ date.format(board.startsAt) }} 开始 · {{ date.format(board.endsAt) }} 零点结束 · {{ board.settled ? '已结算' : board.season === board.current ? '进行中' : '正在结算' }}</p>
        </div>
        <nav class="season-actions" aria-label="选择赛季">
          <button type="button" :disabled="loading || board.season <= 1" @click="load(board.season - 1)">上一季</button>
          <button v-if="board.season !== board.current" type="button" :disabled="loading" @click="load()">返回当前赛季</button>
        </nav>
      </div>
      <div class="my-standing">
        <div>
          <strong>{{ board.mine.rank ? `我的排名 #${board.mine.rank}` : '暂未上榜' }}</strong>
          <p class="secondary">{{ board.mine.rating }} 分 · {{ board.mine.games }} 场 · {{ board.mine.wins }} 胜</p>
          <p v-if="board.mine.rank === null" class="secondary">上榜需打满 10 场实装 PvP，并遇到 5 位不同对手（{{ board.mine.opponents }} / 5）。</p>
        </div>
        <button v-if="board.mine.reward" type="button"
          :disabled="loading || !!error || board.mine.claimed || pets.busy || !!pets.pending || pets.offline"
          @click="claim">{{ board.mine.claimed ? `已领取 ${board.mine.reward} 历练材料` : `领取 ${board.mine.reward} 历练材料` }}</button>
      </div>
      <p v-if="!board.list.length" class="secondary">{{ board.page > 1 ? '这一页暂无排名' : '本赛季暂无上榜玩家' }}</p>
      <div v-else class="table-region" role="region" aria-label="赛季排名明细" tabindex="0">
        <table>
          <thead>
            <tr><th scope="col">排名</th><th scope="col">玩家</th><th scope="col">评级</th><th scope="col">胜场</th><th scope="col">场次</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in board.list" :key="row.rank" :class="{ mine: row.mine }">
              <td>{{ row.rank }}</td>
              <th scope="row">
                <RouterLink v-if="row.name" :to="`/member/${encodeURIComponent(row.name)}`">{{ row.nickname || row.name }}</RouterLink>
                <span v-else>社区玩家</span>
              </th>
              <td>{{ row.rating }}</td><td>{{ row.wins }}</td><td>{{ row.games }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav v-if="board.page > 1 || board.hasNext" class="season-actions page-actions" aria-label="赛季排行榜分页">
        <button type="button" :disabled="loading || board.page <= 1" @click="load(query.season, board.page - 1)">上一页</button>
        <span>第 {{ board.page }} 页</span>
        <button type="button" :disabled="loading || !board.hasNext" @click="load(query.season, board.page + 1)">下一页</button>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.season-heading, .season-header, .my-standing, .season-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.season-heading, .season-header, .my-standing { justify-content: space-between; }
h2, h3, p { margin: 0; }
h2 { font-size: 1rem; }
h3 { font-size: .9rem; }
.secondary { color: var(--fp-muted); font-size: .825rem; margin-block: 4px; }
.my-standing { padding-block: 12px; border-block-start: 1px solid var(--fp-border); margin-block-start: 10px; }
.table-region { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .875rem; text-align: start; }
th, td { text-align: start; padding: 8px 6px; border-block-end: 1px solid var(--fp-border); }
th[scope="row"] { font-weight: 500; overflow-wrap: anywhere; }
th[scope="col"], td { white-space: nowrap; }
.mine { background: var(--fp-primary-soft); }
.page-actions { justify-content: end; margin-block-start: 12px; }
button {
  min-block-size: 44px;
  padding-inline: 12px;
  border: 1px solid var(--fp-border);
  border-radius: 6px;
  background: transparent;
  color: inherit;
}
button:not(:disabled) { cursor: pointer; }
button:not(:disabled):hover { background: var(--fp-hover); }
button:disabled { opacity: .55; }
</style>
