import { defineStore, storeToRefs } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { fpConfirm } from '@/composables/useDialog'
import { profileOperationKey } from '@/api/v3-profile'
import type { SecurityProof } from '@/api/v3-security'
import { createV3PostExport, fetchV3PostExport, downloadV3PostExport, savePrivateExport, exportJobId, type ExportJob } from '@/api/v3-post-export'
export const useV3PostExportStore = defineStore('v3-post-export', () => {
  const auth = useAuthStore(), { accessToken, account } = storeToRefs(auth)
  const revision = ref(0), jobs = ref<ExportJob[]>([]), pendingKey = ref<string | null>(null), unavailable = ref<Record<string, string>>({})
  const busy = ref(false), reading = ref(false), downloading = ref(false), error = ref(''), readError = ref(''), downloadError = ref(''), followupError = ref(''), message = ref('')
  let boundary = getAuthContextVersion(), owner = account.value?.oId, readSequence = 0, downloadSequence = 0
  let readController: AbortController | null = null, downloadController: AbortController | null = null, confirmation: AbortController | null = null, disposeFile: (() => void) | null = null
  function stopDownload() { downloadSequence++; downloadController?.abort(); downloadController = null; downloading.value = false; disposeFile?.(); disposeFile = null }
  function leave() { confirmation?.abort(); confirmation = null; stopDownload() }
  function clear() { revision.value++; readSequence++; leave(); readController?.abort(); readController = null; jobs.value = []; unavailable.value = {}; pendingKey.value = null; busy.value = reading.value = false; error.value = readError.value = downloadError.value = followupError.value = message.value = '' }
  const stop = watch([accessToken, () => account.value?.oId], () => { const context = getAuthContextVersion(), id = account.value?.oId; if (!accessToken.value || context !== boundary || id !== owner) clear(); boundary = context; owner = id }, { flush: 'sync' })
  onScopeDispose(() => { stop(); clear() })
  function capture() { const r = revision.value, context = getAuthContextVersion(), id = account.value?.oId; return () => !import.meta.env.SSR && !!accessToken.value && !!id && id === account.value?.oId && context === getAuthContextVersion() && r === revision.value }
  function install(job: ExportJob) { jobs.value = [job, ...jobs.value.filter(item => item.jobId !== job.jobId)]; delete unavailable.value[job.jobId] }
  function failure(e: unknown) { return e instanceof Error ? e.message : '导出服务暂不可用' }
  async function create(proof: SecurityProof) {
    const valid = capture(); if (!valid() || busy.value) return
    const recovering = pendingKey.value !== null; busy.value = true; error.value = followupError.value = message.value = ''
    let committed = false
    try {
      if (!recovering) {
        const controller = new AbortController(); confirmation = controller
        const accepted = await fpConfirm({ title: '确认导出本人内容', message: '生成全部现存本人文章、评论与本人文章付费区原文的ZIP，包含匿名和私密内容。文件就绪后收取100积分，仅本人授权下载，保留24小时。是否继续？', confirmText: '确认导出', signal: controller.signal })
        if (confirmation === controller) confirmation = null
        if (!accepted || !valid()) return
        pendingKey.value = profileOperationKey()
      }
      const result = await createV3PostExport(proof, pendingKey.value!)
      if (!valid()) return
      committed = true; pendingKey.value = null; install(result); message.value = result.status === 'ready' ? '导出结果已确认，可手动下载。' : '原导出任务已过期，本次恢复未重新生成或收费。'
      try { await auth.reloadAccount() } catch { if (valid()) followupError.value = '导出结果已确认，当前余额刷新失败，请稍后核对流水' }
    } catch (e) { if (valid()) { if (committed) followupError.value = '导出已确认，后续刷新失败，请核对当前状态'; else { error.value = failure(e); if (!recovering && e instanceof ApiError && e.status >= 400 && e.status < 500) pendingKey.value = null } } }
    finally { if (valid()) busy.value = false }
  }
  async function read(raw: string) {
    const valid = capture(); if (!valid() || reading.value || downloading.value) return
    readError.value = ''; let id: string
    try { id = exportJobId(raw) } catch (e) { readError.value = failure(e); return }
    const seq = ++readSequence, controller = new AbortController(); readController?.abort(); readController = controller; reading.value = true
    try { const result = await fetchV3PostExport(id, controller.signal); if (valid() && seq === readSequence) install(result) }
    catch (e) { if (valid() && seq === readSequence) { readError.value = `任务 ${id}：${failure(e)}`; if (e instanceof ApiError && [404,410].includes(e.status)) unavailable.value[id] = e.status === 410 ? '文件已过期' : '任务不存在或当前不可访问' } }
    finally { if (valid() && seq === readSequence) { reading.value = false; readController = null } }
  }
  async function download(raw: string) {
    const valid = capture(); if (!valid() || downloading.value || reading.value) return
    downloadError.value = ''; message.value = ''; let id: string
    try { id = exportJobId(raw) } catch (e) { downloadError.value = failure(e); return }
    stopDownload(); const seq = ++downloadSequence, controller = new AbortController(); downloadController = controller; downloading.value = true
    const current = () => valid() && seq === downloadSequence && !controller.signal.aborted
    try {
      const ready = await fetchV3PostExport(id, controller.signal); if (!current()) return
      install(ready)
      const archive = await downloadV3PostExport(ready, controller.signal); if (!current()) return
      disposeFile = savePrivateExport(archive, id); message.value = '文件已校验并交给浏览器下载；请检查浏览器下载结果。'
    } catch (e) { if (current()) { downloadError.value = `任务 ${id}：${failure(e)}`; if (e instanceof ApiError && [404,410].includes(e.status)) unavailable.value[id] = e.status === 410 ? '文件已过期' : '任务不存在或当前不可访问' } }
    finally { if (current()) { downloading.value = false; downloadController = null } }
  }
  return { revision, jobs, pendingKey, unavailable, busy, reading, downloading, error, readError, downloadError, followupError, message, create, read, download, leave, capture }
})
