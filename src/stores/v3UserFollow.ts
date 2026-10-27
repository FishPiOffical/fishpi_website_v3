import { defineStore, storeToRefs } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { profileOperationKey } from '@/api/v3-profile'
import { setV3UserFollow } from '@/api/v3-user-follow'
import { useAuthStore } from '@/stores/auth'
type Command = { following: boolean; key: string; busy: boolean; error: string }
/** Only unresolved explicit commands persist across SPA views; never persist credentials or relationship snapshots. */
export const useV3UserFollowStore = defineStore('v3-user-follow', () => {
  const { accessToken, account } = storeToRefs(useAuthStore())
  const commands = ref<Record<string,Command>>({}), lastChange = ref({ targetId:'', revision:0 })
  let generation = 0, boundary = getAuthContextVersion(), owner = account.value?.oId
  function reset() { generation++; commands.value = {}; lastChange.value = { targetId:'', revision:lastChange.value.revision + 1 } }
  const stop = watch([accessToken, () => account.value?.oId], () => {
    const next = getAuthContextVersion(), id = account.value?.oId
    if (!accessToken.value || next !== boundary || id !== owner) reset()
    boundary = next; owner = id
  }, {flush:'sync'})
  onScopeDispose(() => { stop(); reset() })
  async function set(targetId: string, following: boolean) {
    const current = generation, context = getAuthContextVersion(), actor = account.value?.oId
    const valid = () => !import.meta.env.SSR && !!accessToken.value && !!actor && actor === account.value?.oId && context === getAuthContextVersion() && current === generation
    if (!valid() || actor === targetId || !/^[1-9][0-9]{0,18}$/.test(targetId)) return
    const previous = commands.value[targetId], recovering = !!previous
    if (previous?.busy) return
    if (previous && previous.following !== following) throw new ApiError('请先确认上一次关注操作的结果',409)
    if (!previous && Object.keys(commands.value).length >= 100) throw new ApiError('请先确认未完成的关注操作',409)
    const command = previous || { following, key:profileOperationKey(), busy:false, error:'' }
    commands.value[targetId] = command; command.busy = true; command.error = ''
    // Mutate the reactive proxy so every mounted button observes in-flight and recovery state.
    const stored = commands.value[targetId]!
    stored.busy = true; stored.error = ''
    try {
      await setV3UserFollow(targetId,following,stored.key)
      if (valid()) { delete commands.value[targetId]; lastChange.value = { targetId, revision:lastChange.value.revision + 1 } }
    } catch (error) {
      if (valid()) {
        stored.error = error instanceof Error ? error.message : '关注操作失败'
        if (!recovering && error instanceof ApiError && error.status >= 400 && error.status < 500) delete commands.value[targetId]
        throw error
      }
    } finally { if (valid() && commands.value[targetId] === stored) stored.busy = false }
  }
  return { commands, lastChange, set }
})
