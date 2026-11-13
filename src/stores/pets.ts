import { computed, onScopeDispose, ref, watch } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { profileOperationKey } from '@/api/v3-profile'
import {
  createPetRiskChallenge, executePetCommand, normalizePetName, readPetCatalog, readPetRisk, readPetState, verifyPetRiskChallenge,
  type PetAction, type PetActivityKind, type PetCatalog, type PetCommand, type PetSpeciesId, type PetState,
  type PetRiskChallenge,
} from '@/api/v3-pets'
import { useAuthStore } from '@/stores/auth'

export interface PetConfirmedEvent {
  sequence: number
  petId: string
  kind: PetCommand['kind']
  action?: PetAction
}

export const usePetsStore = defineStore('pets', () => {
  const { accessToken, account } = storeToRefs(useAuthStore())
  const state = ref<PetState | null>(null)
  const catalog = ref<PetCatalog | null>(null)
  const loading = ref(false), catalogLoading = ref(false), busy = ref(false)
  const error = ref(''), catalogError = ref(''), pendingError = ref('')
  const pending = ref<PetCommand | null>(null)
  const riskStage = ref<'verification' | 'cooldown' | 'ready' | null>(null)
  const riskOpen = ref(false), riskBusy = ref(false), riskError = ref(''), riskUntil = ref(0)
  const riskChallenge = ref<PetRiskChallenge | null>(null)
  const pendingUncertain = ref(false)
  let riskAbort: AbortController | null = null, riskSequence = 0, verifiedUntil = 0, riskClockOffset = 0
  // 仅内存中的本次操作确认信号，不持久化、不广播，也不代替养成快照。
  const confirmedEvent = ref<PetConfirmedEvent | null>(null)
  let confirmationSequence = 0
  const refreshNeeded = ref(false), receivedAt = ref(0)
  const offline = ref(typeof navigator !== 'undefined' && navigator.onLine === false)
  const pet = computed(() => state.value?.pet ?? null)
  const coins = computed(() => state.value?.wallet.coins ?? null)
  const foodQuantity = computed(() => state.value?.inventory.find(item => item.itemId === 'food')?.quantity ?? 0)
  const ready = computed(() => state.value !== null)
  let generation = 0, sequence = 0, catalogSequence = 0
  let boundary = getAuthContextVersion(), owner = account.value?.oId
  let readAbort: AbortController | null = null, catalogAbort: AbortController | null = null
  let writeAbort: AbortController | null = null
  let stateFlight: Promise<void> | null = null, catalogFlight: Promise<void> | null = null
  let attempted = false, catalogAttempted = false, listening = false, invalidated = false
  let stateFailures = 0, catalogFailures = 0, stateRetryAt = 0, catalogRetryAt = 0, lastAutoRead = 0
  let autoTimer: ReturnType<typeof setTimeout> | null = null
  let channel: BroadcastChannel | null = null

  const active = () => !import.meta.env.SSR && !!accessToken.value && !!account.value?.oId
  function capture() {
    const epoch = generation, actor = account.value?.oId, context = getAuthContextVersion()
    return () => active() && epoch === generation && actor === account.value?.oId && context === getAuthContextVersion()
  }
  const message = (reason: unknown, fallback: string) => reason instanceof ApiError ? reason.message : fallback
  // 自动恢复仅由聚焦、联网或跨标签变化触发；拒绝/限流等待用户明确重读，不循环探测。
  const retryAt = (reason: unknown, failures: number) => reason instanceof ApiError && reason.status >= 400 && reason.status < 500
    ? Infinity : Date.now() + Math.min(300_000, 30_000 * 2 ** Math.min(failures - 1, 4))
  function cancelAutoRead() { if (autoTimer !== null) clearTimeout(autoTimer); autoTimer = null }

  function cancelRead() {
    sequence++
    readAbort?.abort()
    readAbort = null
    stateFlight = null
    loading.value = false
  }
  function clear() {
    generation++
    cancelAutoRead()
    writeAbort?.abort()
    writeAbort = null
    cancelRead()
    catalogSequence++
    catalogAbort?.abort()
    catalogAbort = null
    catalogFlight = null
    state.value = catalog.value = null
    pending.value = null
    pendingUncertain.value = false
    resetRisk()
    confirmedEvent.value = null
    busy.value = catalogLoading.value = refreshNeeded.value = false
    error.value = catalogError.value = pendingError.value = ''
    receivedAt.value = 0
    attempted = catalogAttempted = invalidated = false
    stateFailures = catalogFailures = stateRetryAt = catalogRetryAt = lastAutoRead = 0
  }

  function cancelRiskRead() {
    riskSequence++
    riskAbort?.abort()
    riskAbort = null
    riskBusy.value = false
    riskChallenge.value = null
  }
  function resetRisk() {
    cancelRiskRead()
    riskOpen.value = false
    riskStage.value = null
    riskError.value = ''
    riskUntil.value = verifiedUntil = riskClockOffset = 0
  }
  function closeRisk() {
    // 关闭仅销毁证明与请求，原命令仍保留，不能把未知消费当成取消成功。
    cancelRiskRead()
    riskOpen.value = false
  }
  function cancelRejectedOperation() {
    // 账号冷却期间也不能借“放弃”立即换键再发，窗口仍可关闭稍后处理。
    if (busy.value || pendingUncertain.value || !riskStage.value || Date.now() < riskUntil.value) return
    pending.value = null
    pendingError.value = ''
    resetRisk()
  }
  function applyCooldown(reason: ApiError) {
    const value = reason.retryAfter ?? ''
    const until = /^\d+$/.test(value) ? Date.now() + Number(value) * 1000 : Date.parse(value)
    riskUntil.value = Math.max(riskUntil.value, Number.isFinite(until) ? until : Date.now() + 60_000)
    riskStage.value = 'cooldown'
  }
  async function prepareRisk() {
    if (!active() || offline.value || busy.value || riskBusy.value || !pending.value || !riskStage.value) return
    riskOpen.value = true
    riskError.value = ''
    if (Date.now() < riskUntil.value) return
    const command = pending.value, valid = capture(), run = ++riskSequence, controller = new AbortController()
    riskAbort = controller
    riskChallenge.value = null
    riskBusy.value = true
    const current = () => valid() && run === riskSequence && pending.value?.key === command.key && !controller.signal.aborted
    try {
      const result = await readPetRisk(controller.signal)
      if (!current()) return
      // 服务端时间换算到本机倒计时，避免用户系统时钟不同导致长时间锁住或提前恢复。
      riskClockOffset = result.serverNow - Date.now()
      riskUntil.value = result.retryAt ? result.retryAt - riskClockOffset : 0
      if (riskUntil.value > Date.now()) { riskStage.value = 'cooldown'; return }
      if (!result.verificationRequired || verifiedUntil > Date.now()) { riskStage.value = 'ready'; return }
      riskStage.value = 'verification'
      const challenge = await createPetRiskChallenge(command, controller.signal)
      if (current()) {
        if (challenge.serverNow !== undefined) riskClockOffset = challenge.serverNow - Date.now()
        if (challenge.verified === true && challenge.expiresAt > Date.now() + riskClockOffset) {
          // 验证已成功但回执丢失时，只恢复原命令的授权事实，不重复验证或自动消费。
          verifiedUntil = challenge.expiresAt - riskClockOffset
          riskStage.value = 'ready'
        } else riskChallenge.value = challenge
      }
    } catch (reason) {
      if (!current()) return
      if (reason instanceof ApiError && reason.status === 429) applyCooldown(reason)
      riskError.value = message(reason, '暂时无法开始验证，请稍后重试')
    } finally {
      if (current()) { riskBusy.value = false; riskAbort = null }
    }
  }
  async function submitRiskProof(proof: unknown): Promise<boolean> {
    if (!active() || offline.value || busy.value || riskBusy.value || !pending.value || !riskChallenge.value || !riskOpen.value) return false
    const command = pending.value, challenge = riskChallenge.value
    if (challenge.idempotencyKey !== command.key || challenge.expiresAt <= Date.now() + riskClockOffset) {
      riskChallenge.value = null
      riskError.value = '验证已过期，请重新验证'
      return false
    }
    const valid = capture(), run = ++riskSequence, controller = new AbortController()
    riskAbort = controller
    riskBusy.value = true
    riskError.value = ''
    const current = () => valid() && run === riskSequence && pending.value?.key === command.key && !controller.signal.aborted
    try {
      const result = await verifyPetRiskChallenge(challenge, proof, controller.signal)
      if (!current()) return false
      if (result.serverNow !== undefined) riskClockOffset = result.serverNow - Date.now()
      verifiedUntil = result.expiresAt - riskClockOffset
      riskStage.value = 'ready'
      riskChallenge.value = null
      // 验证只解除当前命令的限制；继续消费必须由用户再次点击，不能暗中重发。
      return true
    } catch (reason) {
      if (!current()) return false
      if (reason instanceof ApiError && reason.status === 429) applyCooldown(reason)
      riskError.value = message(reason, '验证结果未确认，请重新验证')
      riskChallenge.value = null
      return false
    } finally {
      if (current()) { riskBusy.value = false; riskAbort = null }
    }
  }

  function loadState(): Promise<void> {
    if (!active() || offline.value) return Promise.resolve()
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
        // 在途读取之后收到的失效信号不能被旧快照清掉，合并为一次后续读取。
        if (invalidated) { refreshNeeded.value = true; return }
        state.value = result
        receivedAt.value = Date.now()
        refreshNeeded.value = false
        stateFailures = stateRetryAt = 0
      } catch (reason) {
        if (!valid() || run !== sequence || controller.signal.aborted) return
        // 读取失败不能让过时的余额继续作为可操作状态；恢复只重读，不重写。
        state.value = null
        refreshNeeded.value = true
        error.value = message(reason, '宠物暂时没能回到画面，请稍后重试')
        stateRetryAt = retryAt(reason, ++stateFailures)
      } finally {
        if (valid() && run === sequence) {
          loading.value = false
          readAbort = null
        }
      }
    })().finally(() => {
      if (stateFlight === flight) stateFlight = null
      if (valid() && invalidated) scheduleStateRead()
    })
    stateFlight = flight
    return flight
  }

  function reloadCatalog(): Promise<void> {
    if (!active() || offline.value) return Promise.resolve()
    if (catalogFlight) return catalogFlight
    const valid = capture(), run = ++catalogSequence, controller = new AbortController()
    catalogAbort = controller
    catalogLoading.value = true
    catalogError.value = ''
    catalogAttempted = true
    const flight = (async () => {
      try {
        const result = await readPetCatalog(controller.signal)
        if (valid() && run === catalogSequence && !controller.signal.aborted) {
          catalog.value = result
          catalogFailures = catalogRetryAt = 0
        }
      } catch (reason) {
        if (valid() && run === catalogSequence && !controller.signal.aborted) {
          catalog.value = null
          catalogError.value = message(reason, '宠物目录暂不可用')
          catalogRetryAt = retryAt(reason, ++catalogFailures)
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
    cancelAutoRead()
    return loadState()
  }

  function scheduleStateRead() {
    if (!active() || offline.value || busy.value || document.hidden || stateFlight || autoTimer !== null || Date.now() < stateRetryAt) return
    const delay = Math.max(0, lastAutoRead + 1000 - Date.now())
    if (delay) {
      autoTimer = setTimeout(() => { autoTimer = null; scheduleStateRead() }, delay)
      return
    }
    lastAutoRead = Date.now()
    void loadState()
  }
  function onFocus() {
    if (!active() || offline.value || busy.value || !attempted || document.hidden) return
    if (invalidated || refreshNeeded.value || Date.now() - receivedAt.value > 60_000) scheduleStateRead()
    if (catalogAttempted && !catalog.value && Date.now() >= catalogRetryAt) void reloadCatalog()
  }
  function onOffline() {
    offline.value = true
    cancelAutoRead()
    cancelRead()
    catalogSequence++
    catalogAbort?.abort()
    catalogAbort = null
    catalogFlight = null
    catalogLoading.value = false
    writeAbort?.abort(new ApiError('网络已断开，操作结果尚未确认', 0, 'pet_offline'))
    cancelRiskRead()
    if (attempted) { invalidated = refreshNeeded.value = true; error.value = '网络已断开，联网后会核对宠物状态' }
  }
  function onOnline() {
    if (!offline.value) return
    offline.value = false
    // 真实离线后允许一次联网探测，权限拒绝与限流仍不能自动重试。
    if (Number.isFinite(stateRetryAt)) stateRetryAt = 0
    if (Number.isFinite(catalogRetryAt)) catalogRetryAt = 0
    onFocus()
  }
  function listen() {
    if (listening || typeof window === 'undefined') return
    listening = true
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onFocus)
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('fishpi.pet.changed')
        channel.onmessage = event => {
          if (!active() || !event.data || event.data.owner !== account.value?.oId || event.data.type !== 'changed') return
          invalidated = refreshNeeded.value = true
          // 标签页间只传失效信号，不传钱包、宠物资料或访问令牌。
          if (busy.value || document.hidden) return
          scheduleStateRead()
        }
      }
    } catch { /* 禁用跨页通道时，重新聚焦仍会读取当前状态。 */ }
  }
  async function ensureLoaded() {
    if (!active()) return
    listen()
    if (offline.value) {
      attempted = catalogAttempted = true
      refreshNeeded.value = true
      error.value = '网络已断开，联网后会读取宠物状态'
      return
    }
    await Promise.all([
      !attempted ? loadState() : stateFlight,
      !catalogAttempted ? reloadCatalog() : catalogFlight,
    ])
  }

  async function execute(command: PetCommand, recovering = false): Promise<boolean> {
    if (!active() || offline.value || busy.value || riskBusy.value || Date.now() < riskUntil.value) return false
    const valid = capture()
    cancelAutoRead()
    cancelRead()
    const controller = new AbortController()
    writeAbort = controller
    pending.value = Object.freeze({ ...command })
    confirmedEvent.value = null
    busy.value = true
    pendingError.value = error.value = ''
    let confirmed = false
    try {
      const receipt = await executePetCommand(command, controller.signal)
      if (!valid()) return false
      confirmed = true
      pending.value = null
      pendingUncertain.value = false
      resetRisk()
      // 确认后的读取期间保留画面，refreshNeeded 阻止旧余额继续操作，避免桌宠闪烁。
      refreshNeeded.value = true
      try { channel?.postMessage({ type: 'changed', owner: account.value?.oId }) } catch { /* 本页照常重读。 */ }
      await loadState()
      // 写入和当前状态都核对成功才播放；读取失败或已换宠时不延后补播历史成功。
      if (valid() && !refreshNeeded.value && pet.value?.id === receipt.petId) {
        confirmedEvent.value = { sequence: ++confirmationSequence, petId: receipt.petId,
          kind: command.kind, ...(command.kind === 'actions' ? { action: command.action } : {}) }
      }
    } catch (reason) {
      if (!valid()) return false
      const description = message(reason, '这次操作的结果尚未确认，请恢复原操作')
      if (reason instanceof ApiError && (reason.code === 'pet_verification_required' || reason.status === 429)) {
        // 首次明确拒绝与未知结果恢复分开保存，冷却或验证都沿用冻结内容与原键。
        pendingUncertain.value = recovering
        if (reason.status === 429) applyCooldown(reason)
        else { riskStage.value = 'verification'; verifiedUntil = 0 }
        pendingError.value = description
        return false
      }
      // 首次明确拒绝允许改正；未知命令恢复期间的 4xx 不能证明此前未提交。
      if (!recovering && reason instanceof ApiError && reason.status >= 400 && reason.status < 500
          && reason.code !== 'confirmation_required') {
        pending.value = null
        pendingUncertain.value = false
        resetRisk()
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
        pendingUncertain.value = true
        riskStage.value = null
        closeRisk()
        pendingError.value = description
      }
    } finally {
      if (valid()) {
        busy.value = false
        if (writeAbort === controller) writeAbort = null
        if (invalidated && !pending.value) scheduleStateRead()
      }
    }
    return confirmed
  }

  function canWrite() {
    return active() && !offline.value && !!state.value && !busy.value && !pending.value && !loading.value && !refreshNeeded.value
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
    if (itemId) {
      const item = catalog.value?.items.find(item => item.id === itemId)
      const category = action === 'feed' ? 'food' : action === 'water' ? 'drink' : null
      if (!item || item.category !== category || !state.value?.inventory.some(item => item.itemId === itemId && item.quantity > 0)) return Promise.resolve(false)
    }
    return execute({ kind: 'actions', petId: pet.value.id, action, ...(itemId ? { itemId } : {}), key: profileOperationKey() })
  }
  function claimSupply(): Promise<boolean> {
    if (!canWrite() || !pet.value || !state.value || state.value.dailySupply.claimed) return Promise.resolve(false)
    return execute({ kind: 'supplies', expectedDate: state.value.today, key: profileOperationKey() })
  }
  function buyFood(quantity: number): Promise<boolean> {
    return buyItem('food', quantity)
  }
  function buyItem(itemId: string, quantity: number): Promise<boolean> {
    if (!canWrite() || !pet.value || !catalog.value) return Promise.resolve(false)
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
      error.value = '每次可购买 1～20 件物品'
      return Promise.resolve(false)
    }
    const item = catalog.value.items.find(item => item.id === itemId)
    if (!item || item.price === null || item.price * quantity > (coins.value ?? 0)) return Promise.resolve(false)
    return execute({ kind: 'purchases', petId: pet.value.id, itemId, quantity, catalogVersion: catalog.value.version, key: profileOperationKey() })
  }
  function craft(recipeId: string): Promise<boolean> {
    if (!canWrite() || !pet.value || !catalog.value || !state.value || pet.value.activity) return Promise.resolve(false)
    const recipe = catalog.value.recipes.find(recipe => recipe.id === recipeId)
    if (!recipe || state.value.collections.some(item => item.id === recipe.collectionId)
        || recipe.coins > (coins.value ?? 0)
        || recipe.requirements.some(requirement => (pet.value?.skills.find(skill => skill.id === requirement.skillId)?.experience ?? 0) < requirement.experience)
        || recipe.ingredients.some(required => (state.value?.inventory.find(item => item.itemId === required.itemId)?.quantity ?? 0) < required.quantity)) return Promise.resolve(false)
    return execute({ kind: 'crafts', petId: pet.value.id, recipeId, catalogVersion: catalog.value.version, key: profileOperationKey() })
  }
  function claimStory(storyId: string): Promise<boolean> {
    if (!canWrite() || !pet.value || !catalog.value || pet.value.activity
        || !catalog.value.stories.some(story => story.id === storyId)
        || state.value?.stories.find(story => story.id === storyId)?.status !== 'claimable') return Promise.resolve(false)
    return execute({ kind: 'stories/claim', petId: pet.value.id, storyId,
      catalogVersion: catalog.value.version, key: profileOperationKey() })
  }
  async function readopt(speciesId: PetSpeciesId, name: string, resetAccepted: boolean): Promise<boolean> {
    if (!canWrite() || !pet.value || !catalog.value || pet.value.activity || resetAccepted !== true
        || !catalog.value.species.some(species => species.id === speciesId)
        || (coins.value ?? 0) < catalog.value.readoptionRules.coins) return false
    try {
      return await execute({ kind: 'readoption', petId: pet.value.id, speciesId, name: normalizePetName(name),
        catalogVersion: catalog.value.version, resetAccepted: true, key: profileOperationKey() })
    } catch (reason) { error.value = message(reason, '请检查宠物名字'); return false }
  }
  function startActivity(kind: PetActivityKind, entryId: string): Promise<boolean> {
    if (!canWrite() || !pet.value || !catalog.value || pet.value.activity) return Promise.resolve(false)
    const entries = kind === 'outing' ? catalog.value.places : kind === 'course' ? catalog.value.courses : catalog.value.jobs
    const entry = entries.find(entry => entry.id === entryId)
    if (!entry) return Promise.resolve(false)
    if (entry.requirements.some(requirement => (pet.value?.skills.find(skill => skill.id === requirement.skillId)?.experience ?? 0) < requirement.experience)) return Promise.resolve(false)
    if (kind === 'work') {
      const job = catalog.value.jobs.find(item => item.id === entryId)
      const progress = pet.value.skills.find(item => item.id === job?.requirement.skillId)
      if (!job || !progress || progress.experience < job.requirement.experience
          || !state.value || state.value.income.remaining <= 0) return Promise.resolve(false)
    }
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
    if (!pending.value) return Promise.resolve(false)
    if (riskStage.value === 'verification' || riskStage.value === 'cooldown') {
      void prepareRisk()
      return Promise.resolve(false)
    }
    return execute(pending.value, pendingUncertain.value)
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
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onFocus)
    }
  })
  return {
    state, catalog, pet, coins, foodQuantity, ready, receivedAt, confirmedEvent,
    loading, catalogLoading, error, catalogError, busy, pending, pendingError, refreshNeeded, offline,
    riskStage, riskOpen, riskBusy, riskError, riskUntil, riskChallenge, pendingUncertain,
    prepareRisk, submitRiskProof, closeRisk, cancelRejectedOperation,
    ensureLoaded, refresh, reloadCatalog, adopt, rename, act, claimSupply, buyFood, buyItem, craft, claimStory, readopt, startActivity, claimActivity, retryPending,
  }
})
