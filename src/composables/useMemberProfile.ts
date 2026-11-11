import { inject, onMounted, onScopeDispose, ref, watch, type InjectionKey, type Ref } from 'vue'
import { decodePublicUser, fetchPublicUser, type PublicUser } from '@/api/v3-public-user'
import { consumeMemberPayload } from '@/seo/payload'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

import { shouldInvalidatePublicSnapshot, PUBLIC_LIST_TTL, memberSnapshotKey, readPublicSnapshot, removePublicSnapshot, savePublicSnapshot } from '@/utils/publicSnapshots'

function publicCard(profile: PublicUser) {
  const { userPoint: _points, onlineMinute: _minutes, userCity: _city, userOnlineFlag: _online, ...card } = profile
  return card
}

type MemberProfile = {
  profile: Ref<PublicUser | null>
  profileError: Ref<string>
  profileLoading: Ref<boolean>
  profileFromCache: Ref<boolean>
  readProfile: () => Promise<void>
}
export const MEMBER_PROFILE_KEY: InjectionKey<MemberProfile> = Symbol('member-profile')

export function useMemberProfile(name: Ref<string>): MemberProfile {
  const shared = inject(MEMBER_PROFILE_KEY, null)
  if (shared) return shared
  const auth = useAuthStore()
  const profile = ref<PublicUser | null>(consumeMemberPayload(name.value))
  const profileError = ref(''), profileLoading = ref(false), profileFromCache = ref(false)
  let mounted = false, sequence = 0, snapshotExpires = 0

  async function readProfile() { await read(true) }
  async function read(restore: boolean) {
    if (!mounted || import.meta.env.SSR) return
    const run = ++sequence, target = name.value, context = getAuthContextVersion()
    const token = auth.accessToken, actor = auth.account?.oId
    const valid = () => mounted && run === sequence && target === name.value && context === getAuthContextVersion() && token === auth.accessToken && actor === auth.account?.oId
    const key = memberSnapshotKey(target)
    profileError.value = ''
    if (restore && !profile.value) {
      const snapshot = await readPublicSnapshot(key, PUBLIC_LIST_TTL, raw => publicCard(decodePublicUser(raw, target)))
      if (!valid()) return
      if (snapshot) { profile.value = snapshot.value; snapshotExpires = snapshot.expires; profileFromCache.value = true }
    }
    profileLoading.value = profile.value === null
    try {
      const result = await fetchPublicUser(target, 'omit')
      if (valid()) {
        const sameProfile = snapshotExpires > Date.now() && profile.value?.id === result.id
        profile.value = sameProfile && profile.value
          ? { ...profile.value, cardBg: result.cardBg, userPoint: result.userPoint, onlineMinute: result.onlineMinute }
          : result
        profileFromCache.value = false
        if (!sameProfile) { snapshotExpires = 0; savePublicSnapshot(key, publicCard(result)) }
      }
    } catch (error) {
      if (valid()) {
        if (shouldInvalidatePublicSnapshot(error)) { removePublicSnapshot(key); profile.value = null }
        profileError.value = error instanceof Error ? error.message : '用户资料读取失败'
      }
    } finally {
      if (valid()) profileLoading.value = false
    }
  }
  const stop = watch([name, () => auth.accessToken, () => auth.account?.oId], ([target], [previousTarget]) => {
    sequence++
    if (target !== previousTarget) { profile.value = null; snapshotExpires = 0; profileFromCache.value = false }
    profileError.value = ''
    void read(true)
  }, { flush: 'sync' })
  onMounted(() => {
    mounted = true
    if (!profile.value || auth.accessToken) void read(true)
  })
  onScopeDispose(() => { mounted = false; sequence++; stop(); profile.value = null })
  return { profile, profileError, profileLoading, profileFromCache, readProfile }
}
