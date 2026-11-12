import { computed, onScopeDispose, ref, watch } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { profileOperationKey } from '@/api/v3-profile'
import {
  executePetCommand, normalizePetName, readPetCatalog, readPetState,
  type PetAction, type PetActivityKind, type PetCatalog, type PetCommand, type PetSpeciesId, type PetState,
} from '@/api/v3-pets'
import { useAuthStore } from '@/stores/auth'

export const usePetsStore = defineStore('pets', () => {
  const { accessToken, account } = storeToRefs(useAuthStore())
  const state = ref<PetState | null>(null)
  const catalog = ref<PetCatalog | null>(null)
  const loading = ref(false), catalogLoading = ref(false), busy = ref(false)
  const error = ref(''), catalogError = ref(''), pendingError = ref('')
  const pending = ref<PetCommand | null>(null)
  const refreshNeeded = ref(false), receivedAt = ref(0)
  const pet = computed(() => state.value?.pet ?? null)
  const coins = computed(() => state.value?.wallet.coins ?? null)
  const foodQuantity = computed(() => state.value?.inventory.find(item => item.itemId === 'food')?.quantity ?? 0)
  const ready = computed(() => state.value !== null)
  let generation = 0, sequence = 0, catalogSequence = 0
  let boundary = getAuthContextVersion(), owner = account.value?.oId
  let readAbort: AbortController | null = null, catalogAbort: AbortController | null = null
  let stateFlight: Promise<void> | null = null, catalogFlight: Promise<void> | null = null
  let attempted = false, catalogAttempted = false, listening = false, invalidated = false
  let channel: BroadcastChannel | null = null

  const active = () => !import.meta.env.SSR && !!accessToken.value && !!account.value?.oId
  function capture() {
    const epoch = generation, actor = account.value?.oId, context = getAuthContextVersion()
    return () => active() && epoch === generation && actor === account.value?.oId && context === getAuthContextVersion()
  }
  const message = (reason: unknown, fallback: string) => reason instanceof ApiError ? reason.message : fallback

  function cancelRead() {
    sequence++
    readAbort?.abort()
    readAbort = null
    stateFlight = null
    loading.value = false
  }
  function clear() {
    generation++
    cancelRead()
    catalogSequence++
    catalogAbort?.abort()
    catalogAbort = null
    catalogFlight = null
    state.value = catalog.value = null
    pending.value = null
    busy.value = catalogLoading.value = refreshNeeded.value = false
    error.value = catalogError.value = pendingError.value = ''
    receivedAt.value = 0
    attempted = catalogAttempted = invalidated = false
  }

  function loadState(): Promise<void> {
    if (!active()) return Promise.resolve()
    if (stateFlight) return stateFlight
    const valid = capture(), run = ++sequence, controller = new AbortController()
    readAbort = controller
    loading.value = true
    error.value = ''
    attempted = true
    invalidated = false
    const flight = (async () => {
      try {
        const result = await readPetState(controller.signal)
        if (!valid() || run !== sequence || controller.signal.aborted) return
        state.value = result
        receivedAt.value = Date.now()
        refreshNeeded.value = false
      } catch (reason) {
        if (!valid() || run !== sequence || controller.signal.aborted) return
        // 读取失败不能让过时的余额继续作为可操作状态；恢复只重读，不重写。
        state.value = null
        refreshNeeded.value = true
        error.value = message(reason, '宠物暂时没能回到画面，请稍后重试')
      } finally {
        if (valid() && run === sequence) {
          loading.value = false
          readAbort = null
        }
      }
    })().finally(() => { if (stateFlight === flight) stateFlight = null })
    stateFlight = flight
    return flight
  }

  function reloadCatalog(): Promise<void> {
    if (!active()) return Promise.resolve()
    if (catalogFlight) return catalogFlight
    const valid = capture(), run = ++catalogSequence, controller = new AbortController()
    catalogAbort = controller
    catalogLoading.value = true
    catalogError.value = ''
    catalogAttempted = true
    const flight = (async () => {
      try {
        const result = await readPetCatalog(controller.signal)
        if (valid() && run === catalogSequence && !controller.signal.aborted) catalog.value = result
      } catch (reason) {
        if (valid() && run === catalogSequence && !controller.signal.aborted) {
          catalog.value = null
          catalogError.value = message(reason, '宠物目录暂不可用')
        }
      } finally {
        if (valid() && run === catalogSequence) {
          catalogLoading.value = false
          catalogAbort = null
        }
      }
    })().finally(() => { if (catalogFlight === flight) catalogFlight = null })
    catalogFlight = flight
    return flight
  }

  function refresh(): Promise<void> {
    if (busy.value) return Promise.resolve()
    return loadState()
  }

  function onFocus() {
    if (!active() || busy.value || !attempted || error.value || document.hidden) return
    if (invalidated || Date.now() - receivedAt.value > 60_000) void loadState()
  }
  function listen() {
    if (listening || typeof window === 'undefined') return
    listening = true
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('fishpi.pet.changed')
        channel.onmessage = event => {
          if (!active() || !event.data || event.data.owner !== account.value?.oId || event.data.type !== 'changed') return
          invalidated = true
          // 标签页间只传失效信号，不传钱包、宠物资料或访问令牌。
          if (busy.value || document.hidden) return
          cancelRead()
          void loadState()
        }
      }
    } catch { /* 禁用跨页通道时，重新聚焦仍会读取当前状态。 */ }
  }
  async function ensureLoaded() {
    if (!active()) return
    listen()
    await Promise.all([
      !attempted ? loadState() : stateFlight,
      !catalogAttempted ? reloadCatalog() : catalogFlight,
    ])
  }

  async function execute(command: PetCommand, recovering = false): Promise<boolean> {
    if (!active() || busy.value) return false
    const valid = capture()
    cancelRead()
    pending.value = Object.freeze({ ...command })
    busy.value = true
    pendingError.value = error.value = ''
    let confirmed = false
    try {
      await executePetCommand(command)
      if (!valid()) return false
      confirmed = true
      pending.value = null
      // 确认后的读取期间保留画面，refreshNeeded 阻止旧余额继续操作，避免桌宠闪烁。
      refreshNeeded.value = true
      try { channel?.postMessage({ type: 'changed', owner: account.value?.oId }) } catch { /* 本页照常重读。 */ }
      await loadState()
    } catch (reason) {
      if (!valid()) return false
      const description = message(reason, '这次操作的结果尚未确认，请恢复原操作')
      // 首次明确拒绝允许改正；未知命令恢复期间的 4xx 不能证明此前未提交。
      if (!recovering && reason instanceof ApiError && reason.status >= 400 && reason.status < 500
          && reason.code !== 'confirmation_required') {
        pending.value = null
        if (reason.code === 'catalog_changed') {
          // 价格版本被明确拒绝后，先让用户更新目录，不能继续按旧价格创建新命令。
          catalog.value = null
          catalogError.value = description
        } else if (command.kind === 'activities/claim' && reason.status === 409 && reason.code === 'activity_claimed') {
          // 其他设备已领取时只核对一次当前状态；读错保留读取恢复入口，不重新领取。
          refreshNeeded.value = true
          await loadState()
        } else {
          error.value = description
        }
      } else {
        pendingError.value = description
      }
    } finally {
      if (valid()) {
        busy.value = false
        if (invalidated && !error.value && !pending.value && !document.hidden) void loadState()
      }
    }
    return confirmed
  }

  function canWrite() {
    return active() && !!state.value && !busy.value && !pending.value && !loading.value && !refreshNeeded.value
  }
  async function adopt(speciesId: PetSpeciesId, name: string) {
    if (!canWrite() || pet.value || !catalog.value?.species.some(species => species.id === speciesId)) return false
    try {
      return await execute({ kind: 'adoption', speciesId, name: normalizePetName(name), key: profileOperationKey() })
    } catch (reason) { error.value = message(reason, '请检查宠物名字'); return false }
  }
  async function rename(name: string) {
    if (!canWrite() || !pet.value) return false
    try {
      return await execute({ kind: 'name', petId: pet.value.id, name: normalizePetName(name), key: profileOperationKey() })
    } catch (reason) { error.value = message(reason, '请检查宠物名字'); return false }
  }
  function act(action: PetAction, itemId?: string): Promise<boolean> {
    if (!canWrite() || !pet.value) return Promise.resolve(false)
    const activity = pet.value.activity
    if (activity && (activity.kind !== 'rest' || action !== 'wake')) return Promise.resolve(false)
    return execute({ kind: 'actions', petId: pet.value.id, action, ...(itemId ? { itemId } : {}), key: profileOperationKey() })
  }
  function claimSupply(): Promise<boolean> {
    if (!canWrite() || !pet.value || !state.value || state.value.dailySupply.claimed) return Promise.resolve(false)
    return execute({ kind: 'supplies', expectedDate: state.value.today, key: profileOperationKey() })
  }
  function buyFood(quantity: number): Promise<boolean> {
    if (!canWrite() || !pet.value || !catalog.value) return Promise.resolve(false)
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
      error.value = '每次可购买 1～20 份口粮'
      return Promise.resolve(false)
    }
    return execute({ kind: 'purchases', petId: pet.value.id, itemId: 'food', quantity, catalogVersion: catalog.value.version, key: profileOperationKey() })
  }
  function startActivity(kind: PetActivityKind, entryId: string): Promise<boolean> {
    if (!canWrite() || !pet.value || !catalog.value || pet.value.activity) return Promise.resolve(false)
    const entries = kind === 'outing' ? catalog.value.places : kind === 'course' ? catalog.value.courses : []
    const entry = entries.find(entry => entry.id === entryId)
    if (!entry) return Promise.resolve(false)
    const cost = entry.cost
    if ((coins.value ?? 0) < cost.coins || pet.value.energy < cost.energy
        || pet.value.hunger < cost.hunger || pet.value.water < cost.water) return Promise.resolve(false)
    return execute({ kind: 'activities', petId: pet.value.id, activityKind: kind, entryId,
      activityVersion: catalog.value.activityVersion, key: profileOperationKey() })
  }
  function claimActivity(): Promise<boolean> {
    if (!canWrite() || !pet.value || !state.value) return Promise.resolve(false)
    const activity = pet.value.activity
    if (!activity || activity.kind === 'rest') return Promise.resolve(false)
    // 本地计时仅决定按钮是否可用，成果与结束时间仍由服务器在领取事务中核验。
    const now = state.value.serverNow + Math.max(0, Date.now() - receivedAt.value)
    if (activity.status !== 'claimable' && now < activity.endsAt) return Promise.resolve(false)
    return execute({ kind: 'activities/claim', petId: pet.value.id, activityId: activity.id, key: profileOperationKey() })
  }
  function retryPending(): Promise<boolean> {
    return pending.value ? execute(pending.value, true) : Promise.resolve(false)
  }

  const stop = watch([accessToken, () => account.value?.oId], () => {
    const context = getAuthContextVersion(), actor = account.value?.oId
    if (!accessToken.value || context !== boundary || actor !== owner) clear()
    boundary = context
    owner = actor
  }, { flush: 'sync' })
  onScopeDispose(() => {
    stop()
    clear()
    channel?.close()
    if (listening) {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  })
  return {
    state, catalog, pet, coins, foodQuantity, ready, receivedAt,
    loading, catalogLoading, error, catalogError, busy, pending, pendingError, refreshNeeded,
    ensureLoaded, refresh, reloadCatalog, adopt, rename, act, claimSupply, buyFood, startActivity, claimActivity, retryPending,
  }
})
