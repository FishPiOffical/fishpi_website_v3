<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useV3PostExportStore } from '@/stores/v3PostExport'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { fetchV3MfaState, securityProof } from '@/api/v3-security'
const store = useV3PostExportStore(), { accessToken, account } = storeToRefs(useAuthStore())
const { revision, jobs, pendingKey, unavailable, busy, reading, downloading, error, readError, downloadError, followupError, message } = storeToRefs(store)
const currentPassword = ref(''), currentTotp = ref(''), enabled = ref<boolean | null>(null), proofError = ref(''), statusLoading = ref(false), lookup = ref(''), now = ref(Date.now())
let mounted = false, sequence = 0, boundary = getAuthContextVersion(), owner = account.value?.oId, timer: ReturnType<typeof setInterval> | undefined
function erase() { currentPassword.value = currentTotp.value = '' }
function clear() { sequence++; erase(); enabled.value = null; statusLoading.value = false; proofError.value = lookup.value = '' }
async function loadSecurity() { if (busy.value) return; const valid = store.capture(), seq = ++sequence; if (!mounted || !valid()) return; statusLoading.value = true; enabled.value = null; proofError.value = ''; try { const value = await fetchV3MfaState(); if (mounted && valid() && seq === sequence) enabled.value = value } catch (e) { if (mounted && valid() && seq === sequence) proofError.value = e instanceof Error ? e.message : '安全状态读取失败' } finally { if (mounted && valid() && seq === sequence) statusLoading.value = false } }
watch(revision, () => { clear(); if (mounted && accessToken.value && account.value) void loadSecurity() }, { flush: 'sync' })
watch([accessToken, () => account.value?.oId], () => { const context = getAuthContextVersion(), id = account.value?.oId; if (!accessToken.value || context !== boundary || id !== owner) clear(); boundary = context; owner = id }, { flush: 'sync' })
async function create() { if (busy.value || enabled.value === null) return; proofError.value = ''; try { const proof = securityProof(currentPassword.value, currentTotp.value, enabled.value); erase(); await store.create(proof) } catch (e) { proofError.value = e instanceof Error ? e.message : '请填写当前安全证明' } }
onMounted(() => { mounted = true; void loadSecurity(); timer = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => { mounted = false; if (timer) clearInterval(timer); clear(); store.leave() })
function date(value: number) { return new Date(value).toLocaleString() }
</script>
<template>
  <section class="owner-export" aria-label="本人内容私有导出">
    <p>导出仍存在的全部本人文章、评论和本人文章付费区原文，包括匿名、讨论、私密、隐藏、锁定及无效状态。ZIP包含UTF-8清单和Markdown文件；已物理删除的内容和编辑历史不在包中。</p>
    <p>每次导出100积分，仅文件就绪时收费，保留24小时，每次下载需本人有效授权。</p>
    <p v-if="statusLoading">正在读取验证器状态…</p><p v-else-if="enabled !== null">两步验证：{{ enabled ? '已启用' : '未启用' }}</p><button type="button" :disabled="busy || statusLoading" @click="loadSecurity">重新读取导出安全状态</button>
    <form @submit.prevent="create"><fieldset :disabled="busy || enabled === null"><label>当前密码<input v-model="currentPassword" aria-label="导出当前密码" type="password" autocomplete="current-password" /></label><label>当前验证器码（已启用时必填）<input v-model="currentTotp" aria-label="导出当前验证器码" inputmode="numeric" maxlength="6" autocomplete="one-time-code" /></label><button type="submit">{{ pendingKey ? '填写当前证明并恢复原导出' : '核对并创建导出' }}</button></fieldset></form>
    <p v-if="pendingKey" class="hint">导出结果尚未确认，请重新填写当前证明恢复同一任务，不会重新收费。请先完成恢复；刷新页面或退出会清除本地恢复信息。</p>
    <p v-if="proofError" role="alert" class="error">{{ proofError }}</p><p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="followupError" role="alert" class="error">{{ followupError }}</p><p v-if="message" role="status">{{ message }}</p>
    <h2>读取已知导出任务</h2><form @submit.prevent="store.read(lookup)"><label>任务ID<input v-model="lookup" aria-label="查询导出任务ID" inputmode="numeric" maxlength="19" autocomplete="off" /></label><button type="submit" :disabled="reading || downloading">读取任务状态</button></form><p class="hint">只读取任务，不创建或收费。请记录任务ID，刷新页面后仍可在下载期限内用本人授权查询。</p><p v-if="readError" role="alert" class="error">{{ readError }}</p><p v-if="downloadError" role="alert" class="error">{{ downloadError }}</p>
    <ul v-if="jobs.length" class="export-jobs"><li v-for="job in jobs" :key="job.jobId"><h3>任务 {{ job.jobId }}</h3><p>本任务已支付 {{ job.paidPoints }} 积分</p><template v-if="job.status === 'ready'"><p>快照：{{ date(job.capturedAt) }} · 就绪：{{ date(job.createdAt) }}</p><p>文章 {{ job.articleCount }} 篇 · 评论 {{ job.commentCount }} 条 · ZIP {{ job.byteLength.toLocaleString() }} 字节</p><p>期限：{{ date(job.expiresAt) }}</p><p class="hash">SHA-256：{{ job.sha256 }}</p><p v-if="unavailable[job.jobId] || job.expiresAt <= now">{{ unavailable[job.jobId] || '本地时间已到下载期限，请读取服务端状态核实' }}</p><button type="button" :disabled="reading || downloading || !!unavailable[job.jobId]" @click="store.download(job.jobId)">{{ downloading ? '正在校验下载…' : '校验并下载私有ZIP' }}</button></template><p v-else>原任务已过期，同键恢复不会重新生成。</p><button type="button" :disabled="reading || downloading" @click="store.read(job.jobId)">刷新此任务状态</button></li></ul>
  </section>
</template>
<style scoped lang="scss">
.owner-export { margin: 16px 0; } fieldset { border: 0; margin: 0; padding: 0; } label { display: grid; gap: 6px; margin: 12px 0; } input { max-width: 100%; box-sizing: border-box; padding: 9px 12px; color: var(--fp-text); background: var(--fp-bg); border: 1px solid var(--fp-border); border-radius: 8px; } button { padding: 8px 12px; margin: 6px 8px 6px 0; color: var(--fp-text); background: transparent; border: 1px solid var(--fp-border); border-radius: 8px; cursor: pointer; } button:disabled { opacity: .5; cursor: default; } .hint { color: var(--fp-muted); font-size: 13px; } .error { color: #c34a36; } .export-jobs { padding-left: 20px; } .export-jobs li { margin: 20px 0; padding-top: 12px; border-top: 1px solid var(--fp-border); } .hash { overflow-wrap: anywhere; } h2 { font-size: 18px; } h3 { font-size: 16px; }
</style>
