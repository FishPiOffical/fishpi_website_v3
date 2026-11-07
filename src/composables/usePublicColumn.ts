import { onMounted, onScopeDispose, ref, watch, type Ref } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { fetchColumnChapters, fetchPublicColumnDetail, type ColumnChapterPage } from '@/api/v3-public-columns'
import { useAuthStore } from '@/stores/auth'
export function usePublicColumn(id: Ref<string>) {
  const auth = useAuthStore(), meta = ref<Awaited<ReturnType<typeof fetchPublicColumnDetail>> | null>(null), page = ref<ColumnChapterPage | null>(null), p = ref(1)
  const metaError = ref(''), pageError = ref(''), metaLoading = ref(false), pageLoading = ref(false)
  let mounted = false, metaRun = 0, pageRun = 0
  function boundary() { const context = getAuthContextVersion(), target = id.value, token = auth.accessToken, actor = auth.account?.oId; return () => mounted && context === getAuthContextVersion() && target === id.value && token === auth.accessToken && actor === auth.account?.oId }
  async function readMeta() {
    const previous=meta.value?.column.id===id.value?meta.value:null
    metaRun++; meta.value = previous; metaError.value = ''; metaLoading.value = false
    if (!mounted || import.meta.env.SSR) return
    const run = metaRun, valid = boundary(); metaLoading.value = true
    try { const value = await fetchPublicColumnDetail(id.value); if (valid() && run === metaRun) meta.value = value }
    catch (e) { if (valid() && run === metaRun) {if((e as {code?:string})?.code!=='offline')meta.value=null;metaError.value = e instanceof Error ? e.message : '专栏资料读取失败'} }
    finally { if (valid() && run === metaRun) metaLoading.value = false }
  }
  async function readPage(next = p.value) {
    const previous=next===p.value?page.value:null
    pageRun++; page.value = previous; pageError.value = ''; pageLoading.value = false; p.value = next
    if (!mounted || import.meta.env.SSR) return
    const run = pageRun, valid = boundary(); pageLoading.value = true
    try { const value = await fetchColumnChapters(id.value, next); if (valid() && run === pageRun) page.value = value }
    catch (e) { if (valid() && run === pageRun) {if((e as {code?:string})?.code!=='offline')page.value=null;pageError.value = e instanceof Error ? e.message : '章节目录读取失败'} }
    finally { if (valid() && run === pageRun) pageLoading.value = false }
  }
  const stops = [watch(id, () => { meta.value=null;page.value=null;void readMeta(); void readPage(1) }, { flush: 'sync' }), watch([() => auth.accessToken, () => auth.account?.oId], (_, old) => { const same = auth.account?.oId === old[1] && !!auth.accessToken === !!old[0];meta.value=null;page.value=null; void readMeta(); void readPage(same ? p.value : 1) }, { flush: 'sync' })]
  onMounted(() => { mounted = true; void readMeta(); void readPage() })
  const retryPublic=()=>{void readMeta();void readPage()}
  onMounted(()=>{if(typeof window!=='undefined')window.addEventListener('fp:retry-public',retryPublic)})
  onScopeDispose(() => { if(typeof window!=='undefined')window.removeEventListener('fp:retry-public',retryPublic);mounted = false; metaRun++; pageRun++; stops.forEach(stop => stop()); meta.value = null; page.value = null })
  return { meta, page, p, metaError, pageError, metaLoading, pageLoading, readMeta, readPage }
}
