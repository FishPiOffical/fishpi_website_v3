import { defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { getApiMode } from '@/api/mode'
import { gameSaveData } from '@/api/v3-game-saves'
import { fetchLegacyGameSave, saveLegacyGameSave } from '@/api/legacy/game-saves'
import { useAuthStore } from './auth'
export const useLegacyGameSavesStore = defineStore('legacy-game-saves', () => {
  const auth = useAuthStore(), current = ref<string | null>(null), loading = ref(false), readError = ref(''), pending = ref<{ data: string } | null>(null), busy = ref(false), completed = ref(false), error = ref('')
  let generation = 0, readSequence = 0
  const identity = () => JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId]), active = () => !import.meta.env.SSR && getApiMode() === 'v1' && !!auth.apiKey && !!auth.account?.oId
  function clear() { generation++; readSequence++; current.value = null; loading.value = busy.value = completed.value = false; readError.value = error.value = ''; pending.value = null }
  const stop = watch(identity, clear, { flush: 'sync' }); onScopeDispose(() => { stop(); clear() })
  function guard() { const owner = identity(), run = generation; return () => active() && identity() === owner && generation === run }
  async function load() {
    if (!active()) return
    const valid = guard(), run = ++readSequence
    current.value = null; loading.value = true; readError.value = ''
    try { const result = await fetchLegacyGameSave(); if (valid() && run === readSequence) current.value = result }
    catch (failure) { if (valid() && run === readSequence) readError.value = failure instanceof Error ? failure.message : '存档读取失败' }
    finally { if (valid() && run === readSequence) loading.value = false }
  }
  async function save(raw: string) {
    if (!active() || busy.value || pending.value) return false
    let data: string
    try { data = gameSaveData(raw) } catch (failure) { error.value = failure instanceof Error ? failure.message : '存档内容不合法'; return false }
    const valid = guard(); pending.value = { data }; busy.value = true; completed.value = false; error.value = ''; readSequence++; current.value = null; loading.value = false
    try {
      await saveLegacyGameSave(data)
      if (!valid()) return false
      pending.value = null; completed.value = true
      await load()
      return valid()
    } catch (failure) { if (valid()) error.value = (failure instanceof Error ? failure.message : '保存结果未确认') + '。旧接口没有幂等恢复或版本冲突保护，请核对当前云存档，勿自动重复覆盖。'; return false }
    finally { if (valid()) busy.value = false }
  }
  function release() { if (!busy.value) { pending.value = null; error.value = '' } }
  function dismiss() { if (!busy.value && !pending.value) { completed.value = false; error.value = '' } }
  return { current, loading, readError, pending, busy, completed, error, load, save, release, dismiss }
})
