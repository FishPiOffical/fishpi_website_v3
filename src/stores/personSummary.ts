import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { fetchV3UserRelations } from '@/api/v3-user-relations'
import { fetchV3SavedContent } from '@/api/v3-saved-content'
import { useAuthStore } from './auth'
import { useV3UserFollowStore } from './v3UserFollow'
import { useV3ContentRelationsStore } from './v3ContentRelations'

/** 本人资料卡共用计数，只保存在内存；失败保留文字标签，不伪造零。 */
export const usePersonSummaryStore = defineStore('person-summary', () => {
  const auth = useAuthStore(), follows = useV3UserFollowStore(), relations = useV3ContentRelationsStore()
  const following = ref<number | null>(null), collections = ref<number | null>(null)
  const identity = computed(() => JSON.stringify([getAuthContextVersion(), !!auth.accessToken, auth.account?.oId || '']))
  let generation = 0, expires = 0, inflight: Promise<void> | null = null, consumers = 0
  function invalidate() {
    generation++; expires = 0; inflight = null
    following.value = null; collections.value = null
  }
  function read() {
    if (import.meta.env.SSR || !auth.accessToken || !auth.account?.userName) return Promise.resolve()
    if (inflight) return inflight
    if (Date.now() < expires) return Promise.resolve()
    const seq = generation, reader = identity.value, name = auth.account.userName
    const valid = () => seq === generation && reader === identity.value
    const task = Promise.allSettled([
      fetchV3UserRelations(name, 'following', 1, 1),
      fetchV3SavedContent(name, 'collections', true, 1, 1),
    ]).then(([users, posts]) => {
      if (!valid()) return
      following.value = users.status === 'fulfilled' ? users.value.total : null
      collections.value = posts.status === 'fulfilled' ? posts.value.total : null
      // 失败也短暂退避，多个资料卡挂载不会重复请求。
      expires = Date.now() + (users.status === 'fulfilled' && posts.status === 'fulfilled' ? 60_000 : 15_000)
    }).finally(() => { if (inflight === task) inflight = null })
    inflight = task
    return task
  }
  const stopIdentity = watch(identity, () => { invalidate(); if (consumers) void read() }, { flush: 'sync' })
  function refresh() { invalidate(); if (consumers) void read() }
  const stopFollow = watch(() => follows.lastChange, change => { if (change.targetId) refresh() })
  const stopCollection = watch(() => relations.lastChange, change => { if (change.kind === 'collection') refresh() })
  function attach() { consumers++; void read(); return () => { consumers = Math.max(0, consumers - 1) } }
  onScopeDispose(() => { stopIdentity(); stopFollow(); stopCollection(); invalidate() })
  return { following, collections, attach }
})
