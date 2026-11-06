import { inject, onMounted, onScopeDispose, ref, watch, type InjectionKey, type Ref } from 'vue'
import { fetchPublicUser, type PublicUser } from '@/api/v3-public-user'
import { consumeMemberPayload } from '@/seo/payload'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

type MemberProfile = {
  profile: Ref<PublicUser | null>
  profileError: Ref<string>
  profileLoading: Ref<boolean>
  readProfile: () => Promise<void>
}
export const MEMBER_PROFILE_KEY: InjectionKey<MemberProfile> = Symbol('member-profile')

export function useMemberProfile(name: Ref<string>): MemberProfile {
  const shared = inject(MEMBER_PROFILE_KEY, null)
  if (shared) return shared
  const auth = useAuthStore()
  const profile = ref<PublicUser | null>(consumeMemberPayload(name.value))
  const profileError = ref(''), profileLoading = ref(false)
  let mounted = false, sequence = 0

  async function readProfile() {
    if (!mounted || import.meta.env.SSR) return
    const run = ++sequence, target = name.value, context = getAuthContextVersion()
    const token = auth.accessToken, actor = auth.account?.oId
    const valid = () => mounted && run === sequence && target === name.value && context === getAuthContextVersion() && token === auth.accessToken && actor === auth.account?.oId
    profileError.value = ''
    profileLoading.value = profile.value === null
    try {
      const result = await fetchPublicUser(target)
      if (valid()) profile.value = result
    } catch (error) {
      if (valid()) { profile.value = null; profileError.value = error instanceof Error ? error.message : '用户资料读取失败' }
    } finally {
      if (valid()) profileLoading.value = false
    }
  }
  let boundary = `${getAuthContextVersion()}:${!!auth.accessToken}:${auth.account?.oId || ''}:${name.value}`
  const stop = watch([name, () => auth.accessToken, () => auth.account?.oId], () => {
    sequence++
    const next = `${getAuthContextVersion()}:${!!auth.accessToken}:${auth.account?.oId || ''}:${name.value}`
    if (next !== boundary) profile.value = null
    boundary = next
    profileError.value = ''
    void readProfile()
  }, { flush: 'sync' })
  onMounted(() => { mounted = true; if (!profile.value || auth.accessToken) void readProfile() })
  onScopeDispose(() => { mounted = false; sequence++; stop(); profile.value = null })
  return { profile, profileError, profileLoading, readProfile }
}
