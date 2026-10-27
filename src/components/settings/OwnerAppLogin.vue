<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { createAppLoginRequest, readAppLoginStatus, decideAppLogin, type AppLoginRequest, type AppLoginStatus } from '@/api/v3-app-login'
import { appLoginQr } from '@/utils/appLoginQr'
import { useAuthStore } from '@/stores/auth'
import { fpConfirm } from '@/composables/useDialog'

const auth = useAuthStore(), current = ref<AppLoginRequest | null>(null), status = ref<AppLoginStatus | null>(null)
const matrix = ref<ReturnType<typeof appLoginQr> | null>(null), busy = ref(false), error = ref(''), unknown = ref(false), expired = ref(false), now = ref(Date.now())
const labels = { waiting: '等待APP扫码', claimed: 'APP已扫码，等待APP确认', app_confirmed: 'APP已确认，请核对后在网页批准', web_approved: '网页已批准，等待APP完成登录', consumed: 'APP已完成登录，本次二维码已使用', denied: '已拒绝，本次二维码已作废' }
const terminal = computed(() => status.value?.state === 'consumed' || status.value?.state === 'denied')
const remaining = computed(() => current.value ? Math.max(0, Math.ceil((current.value.expiresAt - now.value) / 1000)) : 0)
let mounted = false, generation = 0, boundary = getAuthContextVersion(), owner = auth.account?.oId
let timer: ReturnType<typeof setInterval> | undefined, confirmation: AbortController | null = null
function discard() { generation++; confirmation?.abort(); confirmation = null; current.value = status.value = null; matrix.value = null; busy.value = unknown.value = expired.value = false; error.value = '' }
function validFor(run: number) { return mounted && generation === run && boundary === getAuthContextVersion() && !!auth.accessToken && !!auth.account?.oId && owner === auth.account.oId }
function expire() { if (current.value && !expired.value && now.value >= current.value.expiresAt && !terminal.value) { generation++; confirmation?.abort(); confirmation = null; expired.value = true; unknown.value = false; matrix.value = null; busy.value = false } }
function apply(value: AppLoginStatus) {
  if (!current.value || value.expiresAt !== current.value.expiresAt) throw new ApiError('扫码到期时间不匹配', 502)
  status.value = value; unknown.value = false
  if (terminal.value || value.state !== 'waiting') matrix.value = null
}
function failed(e: unknown) {
  error.value = e instanceof Error ? e.message : '扫码请求失败'
  if (e instanceof ApiError && [401,403,404,410].includes(e.status)) {
    matrix.value = null; expired.value = true; unknown.value = false
  } else unknown.value = true
}
async function create() {
  if (!mounted || !auth.accessToken || !auth.account?.oId || busy.value || current.value && !terminal.value && !expired.value) return
  discard(); const run = generation; busy.value = true
  try {
    const value = await createAppLoginRequest()
    if (!validFor(run)) return
    current.value = value; status.value = { state: value.state, expiresAt: value.expiresAt }; now.value = Date.now(); expire()
    if (!expired.value) matrix.value = appLoginQr(value.qrPayload)
  } catch (e) { if (validFor(run)) { error.value = e instanceof Error ? e.message : '创建失败'; unknown.value = true } }
  finally { if (validFor(run)) busy.value = false }
}
async function read() {
  if (!current.value || !validFor(generation) || busy.value || expired.value) return
  const run = generation, handle = current.value.request; busy.value = true; error.value = ''
  try { const value = await readAppLoginStatus(handle); if (validFor(run) && current.value?.request === handle) apply(value) }
  catch (e) { if (validFor(run)) failed(e) }
  finally { if (validFor(run)) { busy.value = false; now.value = Date.now(); expire() } }
}
async function decide(decision: 'approve' | 'deny') {
  if (!current.value || !validFor(generation) || busy.value || unknown.value || expired.value || terminal.value || decision === 'approve' && status.value?.state !== 'app_confirmed') return
  const run = generation, handle = current.value.request, controller = new AbortController(); confirmation = controller; busy.value = true; error.value = ''
  try {
    const yes = await fpConfirm({ title: decision === 'approve' ? '批准APP登录' : '拒绝APP登录', message: decision === 'approve' ? `确认是你正在使用的APP，并已在APP核对账号 ${auth.account?.userName || ''}。批准后该APP可登录此账号，是否继续？` : '拒绝后本次二维码立即作废。是否继续？', confirmText: decision === 'approve' ? '批准本次登录' : '拒绝本次登录', signal: controller.signal })
    now.value = Date.now(); expire()
    if (!yes || !validFor(run) || controller.signal.aborted || expired.value) return
    const result = await decideAppLogin(handle, decision)
    if (validFor(run) && current.value?.request === handle) apply(result)
  } catch (e) { if (validFor(run)) failed(e) }
  finally { if (confirmation === controller) confirmation = null; if (validFor(run)) busy.value = false }
}
watch([() => auth.accessToken, () => auth.account?.oId], () => {
  const context = getAuthContextVersion(), id = auth.account?.oId
  if (!auth.accessToken || context !== boundary || id !== owner) discard()
  else { generation++; confirmation?.abort(); confirmation = null; busy.value = false; if (current.value && !terminal.value && !expired.value) { unknown.value = true; void read() } }
  boundary = context; owner = id
}, { flush: 'sync' })
onMounted(() => { mounted = true; timer = setInterval(() => { now.value = Date.now(); expire() }, 1000) })
onBeforeUnmount(() => { mounted = false; if (timer) clearInterval(timer); discard() })
</script>

<template>
  <div class="app-login">
    <h2>官方APP扫码登录</h2>
    <p>需要支持v3扫码协议的APP。二维码创建后两分钟有效；先在APP核对账号并确认，再回到这里查询状态并明确批准。请勿分享二维码。</p>
    <p>离开账号页或退出登录会清除本页二维码；未完成的请求到期作废。</p>
    <p v-if="current">本次目标账号：{{ auth.account?.userName }}<span v-if="!expired && !terminal"> · 剩余 {{ remaining }} 秒</span></p>
    <svg v-if="matrix && !expired && !terminal" :viewBox="`0 0 ${matrix.size} ${matrix.size}`" width="220" height="220" role="img" aria-label="短期APP登录二维码" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff" /><path :d="matrix.path" fill="#000" /></svg>
    <p v-if="expired" role="status">本次请求已过期或不可继续，请重新生成。</p>
    <p v-else-if="status" role="status">{{ labels[status.state] }}</p>
    <p v-if="unknown" role="status">结果尚未确认。{{ current ? '请先查询当前状态，不能直接再次批准。' : '未取得请求标识，可以重新生成新二维码；无法批准标识未知的旧请求。' }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="busy" role="status">正在处理…</p>
    <div class="app-login-actions">
      <button v-if="!current || expired || terminal" type="button" :disabled="busy" @click="create()">生成新二维码</button>
      <template v-if="current && !expired && !terminal">
        <button type="button" :disabled="busy" @click="read()">查询扫码状态</button>
        <button v-if="status?.state === 'app_confirmed'" type="button" :disabled="busy || unknown" @click="decide('approve')">批准APP登录</button>
        <button type="button" :disabled="busy || unknown" @click="decide('deny')">拒绝APP登录</button>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-login { padding-top: 20px; border-top: 1px solid var(--fp-border); p { color: var(--fp-muted); overflow-wrap: anywhere; } svg { display: block; max-width: 100%; height: auto; margin: 16px 0; } [role=alert] { color: #d56b64; } }
.app-login-actions { display: flex; gap: 10px; flex-wrap: wrap; button { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--fp-border); background: var(--fp-card); color: var(--fp-text); cursor: pointer; &:disabled { opacity: .5; cursor: default; } } }
</style>
