import { defineStore, storeToRefs } from 'pinia'
import { ref, watch, onScopeDispose } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { readShop, readShopInventory, executeShop, type ShopProduct, type ShopInventory, type ShopCommand } from '@/api/v3-appearance-shop'
import { profileOperationKey } from '@/api/v3-profile'
import { useAuthStore } from './auth'

export const useAppearanceShopStore = defineStore('appearance-shop', () => {
  const auth = useAuthStore()
  const { accessToken, account } = storeToRefs(auth)
  const products = ref<ShopProduct[]>([])
  const inventory = ref<ShopInventory | null>(null)
  const open = ref(false), loading = ref(false), busy = ref(false)
  const error = ref(''), writeError = ref(''), notice = ref('')
  const pending = ref<ShopCommand | null>(null)
  let generation = 0, sequence = 0, controller: AbortController | null = null
  let context = getAuthContextVersion(), owner = account.value?.oId
  const current = () => [generation, getAuthContextVersion(), account.value?.oId, !!accessToken.value].join(':')
  async function load() {
    const captured = current(), run = ++sequence
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    loading.value = true; error.value = ''
    try {
      const [catalog, mine] = await Promise.all([readShop(signal), accessToken.value ? readShopInventory(signal) : Promise.resolve(null)])
      if (captured !== current() || run !== sequence) return
      products.value = catalog; inventory.value = mine
    } catch (e) {
      if (captured === current() && run === sequence && !signal.aborted) {
        error.value = e instanceof Error ? e.message : '外观商城暂不可用'
        inventory.value = null
      }
    } finally { if (captured === current() && run === sequence) loading.value = false }
  }
  function show() { open.value = true; void load() }
  async function execute(command: ShopCommand, recovering = false) {
    if (!accessToken.value || busy.value) return
    const captured = current()
    ++sequence; controller?.abort(); loading.value = false
    pending.value = command; busy.value = true; writeError.value = ''; notice.value = ''
    try {
      await executeShop(command)
      if (captured !== current()) return
      pending.value = null
      notice.value = command.kind === 'buy' ? '购买成功，可在我的外观中装备' : '座驾已更新'
      inventory.value = null
      // 写入成功后读取失败只影响展示，不恢复原购买按钮或重扣积分。
      await load()
      if (command.kind === 'buy' && captured === current()) void auth.reloadAccount()
    } catch (e) {
      if (captured !== current()) return
      writeError.value = e instanceof Error ? e.message : '操作未完成'
      if (!recovering && e instanceof ApiError && e.status >= 400 && e.status < 500 && e.code !== 'confirmation_required') pending.value = null
    } finally { if (captured === current()) busy.value = false }
  }
  function buy(product: ShopProduct, days: 7 | 30) {
    if (pending.value || busy.value || !inventory.value || !product.enabled) return
    return execute({ kind: 'buy', productId: product.id, days, revision: product.revision, key: profileOperationKey() })
  }
  function equip(productId: string) {
    if (pending.value || busy.value || !inventory.value) return
    return execute({ kind: 'mount', productId, key: profileOperationKey() })
  }
  function retry() { if (pending.value) return execute(pending.value, true) }
  const stop = watch([accessToken, () => account.value?.oId], () => {
    const next = getAuthContextVersion(), actor = account.value?.oId
    if (!accessToken.value || next !== context || actor !== owner) {
      generation++; sequence++; controller?.abort()
      inventory.value = null; pending.value = null; busy.value = false; loading.value = false
      writeError.value = ''; notice.value = ''; error.value = ''
    }
    context = next; owner = actor
    if (open.value && !busy.value) void load()
  }, { flush: 'sync' })
  onScopeDispose(() => { stop(); generation++; controller?.abort() })
  return { open, products, inventory, loading, busy, error, writeError, notice, pending, show, load, buy, equip, retry }
})
