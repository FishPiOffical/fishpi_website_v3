import { defineStore, storeToRefs } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { fpConfirm } from '@/composables/useDialog'
import { profileOperationKey } from '@/api/v3-profile'
import { prepareEnterpriseMaterial, createV3EnterpriseApplication, fetchV3IdentityApplications, fetchV3IdentityApplication, type IdentityApplication, type IdentityReceipt } from '@/api/v3-identity'
export const useV3IdentityStore = defineStore('v3-identity', () => {
  const { accessToken, account } = storeToRefs(useAuthStore())
  const revision = ref(0), summary = ref<{ mediaType: string; byteLength: number } | null>(null), pendingKey = ref<string | null>(null), receipt = ref<IdentityReceipt | null>(null)
  const selecting = ref(false), busy = ref(false), error = ref(''), loading = ref(false), loaded = ref(false), readError = ref(''), records = ref<IdentityApplication[]>([]), page = ref(1), pageCount = ref(0), total = ref(0)
  const detail = ref<IdentityApplication | null>(null), detailId = ref(''), detailLoading = ref(false), detailError = ref('')
  let material: Blob | null = null, previewUrl = '', confirmation: AbortController | null = null, selection = 0, listRead = 0, detailRead = 0, boundary = getAuthContextVersion(), owner = account.value?.oId
  function revokePreview() { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = '' }
  function eraseMaterial() { selection++; revokePreview(); material = null; summary.value = null; selecting.value = false }
  function leave() { confirmation?.abort(); confirmation = null; revokePreview(); if (!pendingKey.value) eraseMaterial() }
  function clear() { revision.value++; selection++; listRead++; detailRead++; confirmation?.abort(); confirmation = null; eraseMaterial(); pendingKey.value = null; receipt.value = null; records.value = []; detail.value = null; detailId.value = ''; busy.value = loading.value = loaded.value = detailLoading.value = false; error.value = readError.value = detailError.value = ''; page.value = 1; total.value = pageCount.value = 0 }
  const stop = watch([accessToken, () => account.value?.oId], () => { const context = getAuthContextVersion(), id = account.value?.oId; if (!accessToken.value || context !== boundary || id !== owner) clear(); boundary = context; owner = id }, { flush: 'sync' })
  onScopeDispose(() => { stop(); clear() })
  function capture() { const r = revision.value, context = getAuthContextVersion(), id = account.value?.oId; return () => !import.meta.env.SSR && !!accessToken.value && !!id && id === account.value?.oId && context === getAuthContextVersion() && r === revision.value }
  function failure(e: unknown) { return e instanceof Error ? e.message : '认证服务暂不可用' }
  async function select(file: Blob) {
    const valid = capture(); if (!valid() || pendingKey.value || busy.value) return
    eraseMaterial(); const seq = ++selection; selecting.value = true; error.value = ''
    try { const value = await prepareEnterpriseMaterial(file); if (valid() && seq === selection) { material = value; summary.value = { mediaType: value.type, byteLength: value.size } } }
    catch (e) { if (valid() && seq === selection) error.value = failure(e) }
    finally { if (valid() && seq === selection) selecting.value = false }
  }
  function preview(): string { if (!capture()() || !material) return ''; if (!previewUrl) previewUrl = URL.createObjectURL(material); return previewUrl }
  function clearDraft() { if (busy.value || pendingKey.value) return; eraseMaterial(); error.value = '' }
  async function load(p = page.value) {
    const valid = capture(), seq = ++listRead; if (!valid()) return
    loading.value = true; loaded.value = false; readError.value = ''; records.value = []; page.value = p
    try { const result = await fetchV3IdentityApplications(p); if (valid() && seq === listRead) { records.value = result.list; total.value = result.total; pageCount.value = result.pageCount; loaded.value = true } }
    catch (e) { if (valid() && seq === listRead) readError.value = failure(e) }
    finally { if (valid() && seq === listRead) loading.value = false }
  }
  async function read(id: string) {
    const valid = capture(), seq = ++detailRead; if (!valid()) return
    detail.value = null; detailId.value = id; detailLoading.value = true; detailError.value = ''
    try { const result = await fetchV3IdentityApplication(id); if (valid() && seq === detailRead) detail.value = result }
    catch (e) { if (valid() && seq === detailRead) detailError.value = failure(e) }
    finally { if (valid() && seq === detailRead) detailLoading.value = false }
  }
  async function create() {
    const valid = capture(); if (!valid() || busy.value || selecting.value) return
    if (!material) { error.value = '请先选择一张营业执照图片'; return }
    const frozen = material, recovering = pendingKey.value !== null; busy.value = true; error.value = ''
    try {
      if (!recovering) { const controller = new AbortController(); confirmation = controller; const accepted = await fpConfirm({ title: '确认提交企业认证', message: '将所选营业执照原图直接提交指定审核员。首次成功读取后服务端材料销毁，断网也不能重读；本人仅可查询状态。审核结论不自动发放勋章或改变权限。是否提交？', confirmText: '确认提交', signal: controller.signal }); if (confirmation === controller) confirmation = null; if (!accepted || !valid()) return; pendingKey.value = profileOperationKey() }
      const result = await createV3EnterpriseApplication(frozen, pendingKey.value!)
      if (!valid()) return
      pendingKey.value = null; receipt.value = result; eraseMaterial()
      await Promise.all([load(1), read(result.id)])
    } catch (e) { if (valid()) { error.value = failure(e); if (!recovering && e instanceof ApiError && e.status >= 400 && e.status < 500) { pendingKey.value = null; if (e.code === 'application_pending') await load(1) } } }
    finally { if (valid()) busy.value = false }
  }
  return { revision, summary, pendingKey, receipt, selecting, busy, error, loading, loaded, readError, records, page, pageCount, total, detail, detailId, detailLoading, detailError, select, preview, revokePreview, clearDraft, load, read, create, leave }
})
