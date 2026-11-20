<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { readBrawlInvitations, type BrawlInvitation, type BrawlInviteDecision } from '@/api/v3-pets'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'

const props = defineProps<{ active: boolean }>()
const emit = defineEmits<{ replay: [id: string] }>()
const auth = useAuthStore()
const pets = usePetsStore()
const items = ref<BrawlInvitation[]>([])
const next = ref<string | null>(null)
const loading = ref(false)
const error = ref('')
const loaded = ref(false)
const elapsed = ref(0)
let syncTime = 0
let serverNow = 0
let timer: ReturnType<typeof setInterval> | undefined
let request: AbortController | undefined
const statuses = { pending: '待处理', accepted: '已接受', declined: '已拒绝', cancelled: '已撤销', expired: '已过期' }
const date = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const status = (row: BrawlInvitation) => row.status === 'pending' && row.expiresAt <= serverNow + elapsed.value ? 'expired' : row.status
const locked = computed(() => pets.busy || !!pets.pending || pets.offline)

async function load(before?: string) {
  if (!props.active || !auth.isLoggedIn) return
  request?.abort()
  const controller = new AbortController()
  request = controller
  const context = getAuthContextVersion(), owner = auth.account?.oId
  const current = () => !controller.signal.aborted && context === getAuthContextVersion() && owner === auth.account?.oId
  loading.value = true
  error.value = ''
  try {
    const result = await readBrawlInvitations(before, controller.signal)
    if (!current()) return
    serverNow = result.serverNow
    syncTime = performance.now()
    elapsed.value = 0
    items.value = before
      ? [...items.value, ...result.list.filter(item => !items.value.some(old => old.id === item.id))]
      : result.list
    next.value = result.next
    loaded.value = true
  } catch (reason) {
    if (current()) error.value = reason instanceof Error ? reason.message : '约战邀请暂时无法读取'
  } finally {
    if (current()) loading.value = false
  }
}
function refreshVisible() {
  if (!document.hidden && props.active && !loading.value && !locked.value) void load()
}
async function decide(row: BrawlInvitation, decision: BrawlInviteDecision) {
  if (locked.value || status(row) !== 'pending') return
  const confirmed = await pets.executeBrawl({ kind: 'brawl-invite-decision', inviteId: row.id, decision })
  if (!confirmed && !pets.pending) void load()
}
watch([() => auth.account?.oId, () => auth.isLoggedIn], () => {
  request?.abort()
  items.value = []
  next.value = null
  loading.value = loaded.value = false
  error.value = ''
  if (props.active) void load()
}, { flush: 'sync' })
watch(() => props.active, active => {
  if (active) void load()
  else { request?.abort(); loading.value = false }
}, { immediate: true })
watch(() => pets.confirmedEvent, event => {
  if (event?.kind === 'brawl-invite' || event?.kind === 'brawl-invite-decision') void load()
})
onMounted(() => {
  window.addEventListener('focus', refreshVisible)
  timer = setInterval(() => {
    if (props.active && syncTime) elapsed.value = performance.now() - syncTime
  }, 1000)
})
onUnmounted(() => {
  request?.abort()
  clearInterval(timer)
  window.removeEventListener('focus', refreshVisible)
})
</script>

<template>
  <div class="invite-header">
    <div><h2>约战邀请</h2><p>邀请有效期为 24 小时，接受时使用双方已保存的出战配装。</p></div>
    <button type="button" class="fp-btn" :disabled="loading" @click="load()">刷新邀请</button>
  </div>
  <p v-if="error" class="invite-error" role="alert">{{ error }}</p>
  <p v-else-if="!loaded && loading" role="status">正在读取约战邀请…</p>
  <p v-else-if="loaded && !items.length" class="invite-empty">暂时没有约战邀请。</p>
  <ul v-if="items.length" class="invite-list" :aria-busy="loading">
    <li v-for="row in items" :key="row.id">
      <div class="invite-info">
        <span class="invite-direction">{{ row.outgoing ? '发出的邀请' : '收到的邀请' }}</span>
        <RouterLink :to="{ name: 'ranked-pet-profile', params: { petId: row.petId } }">{{ row.petName }}</RouterLink>
        <span class="invite-date">{{ status(row) === 'pending' ? `${date.format(row.expiresAt)} 到期` : date.format(row.createdAt) }}</span>
      </div>
      <div class="invite-actions">
        <span :data-status="status(row)" class="invite-status">{{ statuses[status(row)] }}</span>
        <template v-if="status(row) === 'pending'">
          <button v-if="row.outgoing" type="button" class="fp-btn" :disabled="locked" @click="decide(row, 'cancel')">撤销</button>
          <template v-else>
            <button type="button" class="fp-btn" :disabled="locked" @click="decide(row, 'decline')">拒绝</button>
            <button type="button" class="fp-btn invite-primary" :disabled="locked" @click="decide(row, 'accept')">接受并对战</button>
          </template>
        </template>
        <button v-if="row.matchId" type="button" class="fp-btn" @click="emit('replay', row.matchId)">查看战报</button>
      </div>
    </li>
  </ul>
  <button v-if="next" type="button" class="fp-btn invite-more" :disabled="loading" @click="load(next)">更早的邀请</button>
</template>

<style scoped>
.invite-header, .invite-list li, .invite-actions { display: flex; align-items: center; gap: 8px; }
.invite-header, .invite-list li { justify-content: space-between; }
.invite-header h2 { margin: 0; font-size: 1rem; }
.invite-header p { margin: 6px 0 0; color: var(--fp-muted); font-size: .86rem; }
.invite-header button { flex: none; }
.invite-error { color: var(--fp-danger-ink); }
.invite-empty { margin: 20px 0 4px; padding: 14px; text-align: center; color: var(--fp-muted); }
.invite-list { list-style: none; padding: 0; margin: 14px 0 0; }
.invite-list li { padding: 12px 0; border-top: 1px solid var(--fp-border); }
.invite-info { display: grid; gap: 4px; min-width: 0; overflow-wrap: anywhere; }
.invite-info a { font-weight: 650; text-decoration: none; }
.invite-info a:hover { color: var(--fp-primary); }
.invite-direction, .invite-date, .invite-status { color: var(--fp-muted); font-size: .75rem; }
.invite-status { padding: 3px 7px; border-radius: 6px; background: var(--fp-bg); }
.invite-status[data-status='accepted'] { background: var(--fp-primary-soft); color: var(--fp-text); }
.invite-actions { flex-wrap: wrap; }
.invite-primary { background: var(--fp-primary-soft); color: var(--fp-text); }
.invite-more { margin-top: 8px; }
@media (max-width: 560px) {
  .invite-list li { align-items: flex-start; flex-direction: column; }
  .invite-actions { align-self: flex-end; }
}
</style>
