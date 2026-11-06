import { onMounted, onScopeDispose, ref, watch, type Ref } from 'vue'
import { fetchPublicUser, type PublicUser } from '@/api/v3-public-user'
import { fetchMemberContent, fetchMemberMoon, type MemberContentKind, type MemberContentPage } from '@/api/v3-member-content'
import type { V3Breezemoon } from '@/api/v3-breezemoon-data'
import { consumeMemberPayload } from '@/seo/payload'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
export function useMemberPage(name: Ref<string>, kind: Ref<string>, moonId: Ref<string>) {
  const auth = useAuthStore(), profile = ref<PublicUser | null>(consumeMemberPayload(name.value)), profileError = ref(''), profileLoading = ref(false)
  const content = ref<MemberContentPage | null>(null), moon = ref<V3Breezemoon | null>(null), contentError = ref(''), contentLoading = ref(false), p = ref(1)
  let mounted = false, profileSequence = 0, contentSequence = 0
  function boundary() { const context = getAuthContextVersion(), token = auth.accessToken, actor = auth.account?.oId, target = name.value; return () => mounted && context === getAuthContextVersion() && token === auth.accessToken && actor === auth.account?.oId && target === name.value }
  async function readProfile() {
    if (!mounted || import.meta.env.SSR) return
    const run = ++profileSequence, current = boundary(); profile.value = null; profileError.value = ''; profileLoading.value = true
    try { const result = await fetchPublicUser(name.value); if (current() && run === profileSequence) profile.value = result }
    catch (e) { if (current() && run === profileSequence) profileError.value = e instanceof Error ? e.message : '用户资料读取失败' }
    finally { if (current() && run === profileSequence) profileLoading.value = false }
  }
  async function readContent(next = p.value) {
    contentSequence++; content.value = null; moon.value = null; contentError.value = ''; contentLoading.value = false; p.value = next
    if (!mounted || import.meta.env.SSR || !['home', 'long', 'comments', 'breezemoons'].includes(kind.value)) return
    const run = contentSequence, current = boundary(), tab = kind.value, id = moonId.value
    const valid = () => current() && run === contentSequence && tab === kind.value && id === moonId.value
    contentLoading.value = true
    try {
      if (tab === 'breezemoons' && id) { const result = await fetchMemberMoon(name.value, id); if (valid()) moon.value = result }
      else { const result = await fetchMemberContent(name.value, tab as MemberContentKind, next); if (valid()) content.value = result }
    } catch (e) { if (valid()) contentError.value = e instanceof Error ? e.message : '用户内容读取失败' }
    finally { if (valid()) contentLoading.value = false }
  }
  const stops = [watch(name, () => { profileSequence++; profile.value = null; profileError.value = ''; p.value = 1; void readProfile(); void readContent(1) }, { flush: 'sync' }), watch([kind, moonId], () => void readContent(1), { flush: 'sync' }), watch([() => auth.accessToken, () => auth.account?.oId], (_, old) => { const same = auth.account?.oId === old[1] && !!auth.accessToken === !!old[0]; void readProfile(); void readContent(same ? p.value : 1) }, { flush: 'sync' })]
  onMounted(() => { mounted = true; void readProfile(); void readContent() })
  onScopeDispose(() => { mounted = false; profileSequence++; contentSequence++; stops.forEach(stop => stop()); profile.value = null; content.value = null; moon.value = null })
  return { profile, profileError, profileLoading, content, moon, contentError, contentLoading, p, readProfile, readContent }
}
