import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useAuthStore } from './auth'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { profileOperationKey } from '@/api/v3-profile'
import { readParking, writeParking, type ParkingInput, type ParkingState } from '@/api/v3-parking'
import { createGameRiskChallenge, verifyPetRiskChallenge, type PetRiskChallenge } from '@/api/v3-pets'

export const useParkingStore = defineStore('parking', () => {
  const auth = useAuthStore()
  const state = ref<ParkingState | null>(null), receivedAt = ref(0)
  const loading = ref(false), busy = ref(false), readError = ref(''), message = ref('')
  const pending = ref<{ input: ParkingInput; key: string } | null>(null)
  const scope = ref<'all' | 'following'>('all'), host = ref('')
  const needsProof = ref(false), challenge = ref<PetRiskChallenge | null>(null)
  let generation = 0, readSequence = 0, uncertain = false
  const identity = () => [auth.account?.oId, !!auth.accessToken, getAuthContextVersion()].join('|')
  watch(identity, () => {
    scope.value = 'all'; host.value = ''
    generation++; readSequence++; state.value = null; pending.value = null; challenge.value = null
    loading.value = busy.value = uncertain = needsProof.value = false; readError.value = message.value = ''
  }, { flush: 'sync' })
  function canRead() { return !import.meta.env.SSR && !!auth.accessToken && !!auth.account?.oId }
  async function load(after = '') {
    if (!canRead()) return
    const seq = ++readSequence, actor = identity()
    loading.value = true; readError.value = ''
    try {
      const result = await readParking(after, scope.value, host.value)
      if (seq !== readSequence || actor !== identity()) return
      state.value = result; receivedAt.value = Date.now()
    } catch (e) {
      if (seq === readSequence && actor === identity()) {
        state.value = null; readError.value = e instanceof Error ? e.message : '车位读取失败'
      }
    } finally { if (seq === readSequence) loading.value = false }
  }
  async function run() {
    const cmd = pending.value
    if (!cmd || busy.value || !canRead()) return
    const gen = generation
    busy.value = true; message.value = ''
    try {
      const amount = await writeParking(cmd.input, cmd.key)
      if (gen !== generation) return
      pending.value = null; uncertain = needsProof.value = false; challenge.value = null
      const labels = { starter: '初始车已入库', buy: '购车成功', park: '已停入车位', collect: '收车到账', ticket: '已贴条，车主到账', pardon: '本次停车已放行' }
      message.value = labels[cmd.input.action] + (['collect','ticket','buy'].includes(cmd.input.action) ? ' ' + amount + ' 游园币' : '')
      await load()
    } catch (e) {
      if (gen !== generation) return
      message.value = e instanceof Error ? e.message : '操作结果待确认'
      if (e instanceof ApiError && e.code === 'parking_verification_required') needsProof.value = true
      else if (!(e instanceof ApiError) || !e.status || e.status === 408 || e.status >= 500 || e.code === 'invalid_response') {
        uncertain = true
        message.value = '尚未确认操作结果，请继续原操作核对。'
      }
      else if (!uncertain && e.status !== 429) {
        pending.value = null; challenge.value = null; needsProof.value = false
        if (e.status === 409 || e.status === 404) await load()
      }
    } finally { if (gen === generation) busy.value = false }
  }
  function submit(input: ParkingInput) {
    if (pending.value || busy.value || !canRead()) return
    pending.value = { input, key: profileOperationKey() }; uncertain = false
    return run()
  }
  async function verification(proof?: unknown) {
    const cmd = pending.value, gen = generation
    if (!cmd || busy.value || !needsProof.value || !canRead()) return
    busy.value = true
    try {
      if (proof && challenge.value) {
        await verifyPetRiskChallenge(challenge.value, proof)
      } else {
        const result = await createGameRiskChallenge('parking-start', cmd.key)
        if (gen !== generation) return
        if (!result.verified) { challenge.value = result; return }
      }
      if (gen === generation) { challenge.value = null; needsProof.value = false; message.value = '已验证，可以继续原停车操作' }
    } catch (e) {
      if (gen === generation) { challenge.value = null; message.value = e instanceof Error ? e.message : '验证失败' }
    } finally { if (gen === generation) busy.value = false }
  }
  function cancelVerifiedFailure() {
    if (needsProof.value && !uncertain && !busy.value) { pending.value = null; needsProof.value = false; challenge.value = null; message.value = '' }
  }
  return { scope, host, state, receivedAt, loading, busy, pending, message, readError, challenge, needsProof, load, run, submit, verification, cancelVerifiedFailure }
})
