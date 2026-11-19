import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { profileOperationKey } from '@/api/v3-profile'
import { readPartners, writePartner, type PartnerCommand } from '@/api/v3-partners'
import { useAuthStore } from './auth'

export const usePartnersStore = defineStore('partners', () => {
  const auth = useAuthStore()
  const state = ref<Awaited<ReturnType<typeof readPartners>> | null>(null)
  const loading = ref(false), busy = ref(false), error = ref(''), message = ref('')
  const cursor = ref(''), target = ref('')
  const pending = ref<{ cmd: PartnerCommand; key: string } | null>(null)
  let sequence = 0, uncertain = false
  const identity = () => [getAuthContextVersion(), auth.account?.oId, !!auth.accessToken].join('|')
  watch(identity, () => {
    sequence++
    state.value = pending.value = null
    loading.value = busy.value = uncertain = false
    error.value = message.value = cursor.value = target.value = ''
  }, { flush: 'sync' })

  async function load(after = cursor.value, peer = target.value) {
    if (import.meta.env.SSR || !auth.account?.oId || !auth.accessToken) return
    const seq = ++sequence
    if (target.value !== peer) state.value = null
    target.value = peer
    cursor.value = after
    loading.value = true
    error.value = ''
    try {
      const result = await readPartners(after, peer)
      if (seq === sequence) state.value = result
    } catch (e) {
      if (seq === sequence) {
        state.value = null
        error.value = e instanceof Error ? e.message : '搭子读取失败'
      }
    } finally { if (seq === sequence) loading.value = false }
  }

  async function run() {
    const command = pending.value, actor = identity()
    if (!command || busy.value || !auth.accessToken) return
    busy.value = true
    message.value = ''
    try {
      await writePartner(command.cmd, command.key)
      if (actor !== identity()) return
      pending.value = null
      uncertain = false
      await load()
    } catch (e) {
      if (actor !== identity()) return
      if (!(e instanceof ApiError) || !e.status || e.status >= 500 || e.status === 408 || e.code === 'invalid_response') uncertain = true
      if (uncertain) message.value = '结果尚未确认，请核对原操作。'
      else {
        pending.value = null
        message.value = e instanceof Error ? e.message : '操作失败'
        if (e instanceof ApiError && e.status === 409) await load()
      }
    } finally { if (actor === identity()) busy.value = false }
  }
  function submit(cmd: PartnerCommand) {
    if (pending.value || busy.value || loading.value || !auth.accessToken) return
    pending.value = { cmd, key: profileOperationKey() }
    return run()
  }
  return { state, loading, busy, pending, error, message, cursor, load, submit, run }
})
