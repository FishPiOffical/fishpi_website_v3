<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { useV3ChatTimelineStore } from '@/stores/v3ChatTimeline'
import { useChatPreferencesStore } from '@/stores/chatPreferences'
import { useChatFilterStore } from '@/stores/chatFilter'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { avatarThumbnail, DEFAULT_AVATAR } from '@/utils/avatar'
import { mountAssets } from '@/utils/mounts'
import { setChatPresenceWanted, type ChatRoomNotice } from '@/api/v3-realtime'

type Arrival = Extract<ChatRoomNotice, { kind: 'join' | 'leave' }>
const route = useRoute(), chat = useChatStore(), timeline = useV3ChatTimelineStore()
const preferences = useChatPreferencesStore(), filter = useChatFilterStore(), auth = useAuthStore()
const visible = computed(() => route.path === '/cr' || chat.floatingChatroomOpen)
const row = ref<Arrival | null>(null)
const queue: { notice: Arrival; receivedAt: number }[] = []
const seen = new Set<string>()
let timer: ReturnType<typeof setTimeout> | undefined
function avatarError(event: Event) {
  const image = event.target as HTMLImageElement
  if (!image.src.endsWith(DEFAULT_AVATAR)) image.src = DEFAULT_AVATAR
}
function clear() { clearTimeout(timer); queue.length = 0; row.value = null }
function next() {
  clearTimeout(timer); row.value = null
  if (!visible.value || !preferences.mountEffects || !timeline.connected) { clear(); return }
  while (queue.length) {
    const item = queue.shift()!
    if (Date.now() - item.receivedAt > 15000) continue
    row.value = item.notice
    timer = setTimeout(next, 4100)
    break
  }
}
watch(() => timeline.notices, notices => {
  for (const notice of notices) {
    if (seen.has(notice.id)) continue
    seen.add(notice.id)
    if (seen.size > 200) seen.delete(seen.values().next().value!)
    if (!visible.value || !preferences.mountEffects || notice.kind !== 'join' || !notice.mount || !mountAssets[notice.mount.id]) continue
    if (filter.modeFor({ ...notice.actor, userOId: notice.actor.id, card: { text: notice.text } }) !== 'show') continue
    if (queue.length >= 3) queue.shift()
    queue.push({ notice, receivedAt: Date.now() })
  }
  if (!row.value) next()
}, { flush: 'sync' })
watch([visible, () => preferences.mountEffects, () => timeline.connected], () => { if (!visible.value || !preferences.mountEffects || !timeline.connected) clear() })
watch(() => `${getAuthContextVersion()}:${auth.account?.oId}:${!!auth.accessToken}`, () => { clear(); seen.clear() })
watch(visible, value => { if (!import.meta.env.SSR) setChatPresenceWanted(value) }, { immediate: true })
onBeforeUnmount(() => { clear(); setChatPresenceWanted(false) })
</script>
<template>
  <div v-if="row && row.mount" :key="row.id" class="mount-arrival" role="status">
    <img class="vehicle" :src="mountAssets[row.mount.id]" alt="">
    <div class="arrival-copy">
      <div class="arrival-user"><img :src="avatarThumbnail(row.avatarURL, 20)" alt="" @error="avatarError"><strong>{{ row.actor.userNickname || row.actor.userName }}</strong></div>
      <span>{{ row.text.replace(/进入了聊天室$/, '来了') }}</span>
    </div>
  </div>
</template>
<style scoped>
.mount-arrival { position:fixed; left:16px; bottom:26px; z-index:1050; display:flex; align-items:center; gap:4px; width:max-content; max-width:min(320px,calc(100vw - 32px)); padding:4px 14px 4px 0; border-radius:0 30px 30px 0; background:linear-gradient(90deg,transparent,color-mix(in srgb,#a3d7c8 24%,var(--fp-card)) 38%,var(--fp-card)); color:var(--fp-text); pointer-events:none; animation:mount-arrive 4.1s both; }
.vehicle { width:76px; height:52px; flex:none; object-fit:contain; }
.arrival-copy { min-width:0; font-size:12px; line-height:1.4; }
.arrival-copy>span { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.arrival-user { display:flex; align-items:center; gap:5px; margin-bottom:2px; }
.arrival-user img { width:20px; height:20px; border-radius:4px; object-fit:cover; }
.arrival-user strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
@keyframes mount-arrive { 0% { transform:translateX(calc(-100% - 20px)); opacity:0; } 15%,88% { transform:translateX(0); opacity:1; } 100% { transform:translateX(20px); opacity:0; } }
@media(max-width:600px) { .mount-arrival { bottom:calc(100px + env(safe-area-inset-bottom)); left:8px; max-width:calc(100vw - 16px); } .vehicle { width:64px; height:44px; } }
@media(prefers-reduced-motion:reduce) { .mount-arrival { animation:none; } .vehicle { display:none; } .mount-arrival { padding:12px 18px; border-radius:12px; } }
</style>
