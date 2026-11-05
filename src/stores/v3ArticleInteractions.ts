import { defineStore, storeToRefs } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { profileOperationKey } from '@/api/v3-profile'
import { writeArticleInteraction, type ArticleInteractionKind, type VoteChoice, type InteractionResource } from '@/api/v3-article-interactions'
import { useAuthStore } from '@/stores/auth'
type Command = { choice: VoteChoice; key: string; busy: boolean; error: string }
/** Only unresolved explicit commands persist across SPA views; never persist credentials or relationship snapshots. */
export const useV3ArticleInteractionsStore = defineStore('v3-article-interactions', () => {
  const auth = useAuthStore()
  const { accessToken, account } = storeToRefs(auth)
  const balanceError = ref('')
  const commands = ref<Record<string,Command>>({}), lastChange = ref({ targetId:'', kind:'' as ArticleInteractionKind|'', resource:'articles' as InteractionResource, revision:0 })
  let generation = 0, boundary = getAuthContextVersion(), owner = account.value?.oId
  function reset() { generation++; commands.value = {}; balanceError.value = ''; lastChange.value = { targetId:'', kind:'', resource:'articles', revision:lastChange.value.revision + 1 } }
  const stop = watch([accessToken, () => account.value?.oId], () => {
    const next = getAuthContextVersion(), id = account.value?.oId
    if (!accessToken.value || next !== boundary || id !== owner) reset()
    boundary = next; owner = id
  }, {flush:'sync'})
  onScopeDispose(() => { stop(); reset() })
  async function set(kind:ArticleInteractionKind, targetId: string, choice: VoteChoice, resource:InteractionResource='articles') {
    const current = generation, context = getAuthContextVersion(), actor = account.value?.oId
    const valid = () => !import.meta.env.SSR && !!accessToken.value && !!actor && actor === account.value?.oId && context === getAuthContextVersion() && current === generation
    if (!['articles','comments'].includes(resource) || resource === 'comments' && kind === 'reward' || resource === 'articles' && kind === 'accept') throw new ApiError('互动类型不合法',422)
    if (!valid() || !['vote','thanks','reward','accept'].includes(kind) || !/^[1-9][0-9]{0,18}$/.test(targetId)) return
    const identity=(resource === 'comments' ? 'comments:' : '')+kind+':'+targetId
    const previous = commands.value[identity], recovering = !!previous
    if (previous?.busy) return
    if (previous && previous.choice !== choice) throw new ApiError('请先确认上一次互动操作的结果',409)
    if (!previous && Object.keys(commands.value).length >= 100) throw new ApiError('请先确认未完成的互动操作',409)
    const command = previous || { choice, key:profileOperationKey(), busy:false, error:'' }
    commands.value[identity] = command; command.busy = true; command.error = ''
    // Mutate the reactive proxy so every mounted button observes in-flight and recovery state.
    const stored = commands.value[identity]!
    stored.busy = true; stored.error = ''; balanceError.value = ''
    try {
      await writeArticleInteraction(kind,targetId,choice,stored.key,resource)
      if (valid()) { delete commands.value[identity]; lastChange.value = { targetId, kind, resource, revision:lastChange.value.revision + 1 }
        if (kind !== 'vote') {
          try { await auth.reloadAccount() }
          catch { if (valid()) balanceError.value = '操作已确认，当前余额刷新失败，请到积分页核对。' }
        }
      }
    } catch (error) {
      if (valid()) {
        stored.error = error instanceof Error ? error.message : '互动操作失败'
        if (!recovering && error instanceof ApiError && error.status >= 400 && error.status < 500) delete commands.value[identity]
        throw error
      }
    } finally { if (valid() && commands.value[identity] === stored) stored.busy = false }
  }
  return { commands, lastChange, balanceError, set }
})
