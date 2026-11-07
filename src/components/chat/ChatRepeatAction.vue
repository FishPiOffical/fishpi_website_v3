<script setup lang="ts">
import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { chatMessageDetail } from '@/api/v3-chat-messages'
import { useAuthStore } from '@/stores/auth'
import { useV3ChatPublicationStore } from '@/stores/v3ChatPublication'
const props = defineProps<{id:string}>(), auth = useAuthStore(), publication = useV3ChatPublicationStore()
const mounted = ref(false), reading = ref(false), error = ref('')
let sequence = 0, abort: AbortController | null = null
const identity = () => JSON.stringify([getAuthContextVersion(), !!auth.accessToken, auth.account?.oId || ''])
function cancel() { sequence++; abort?.abort(); abort = null; reading.value = false; error.value = '' }
async function repeat() {
  if (!mounted.value || !auth.accessToken || !auth.account?.oId || reading.value || publication.busy || publication.pending) return
  cancel()
  const run = sequence, reader = identity(), id = props.id, controller = new AbortController()
  abort = controller; reading.value = true
  const valid = () => mounted.value && run === sequence && reader === identity() && id === props.id && !controller.signal.aborted
  try {
    const message = await chatMessageDetail(id, controller.signal)
    if (!valid()) return
    if (message.type !== 'text' || !message.content.trim()) { error.value = '当前消息无法复读'; return }
    await publication.send(message.content, 'repeat')
  } catch (e) { if (valid()) error.value = e instanceof Error ? e.message : '原消息读取失败' }
  finally { if (valid()) { reading.value = false; abort = null } }
}
onMounted(() => { mounted.value = true })
watch([identity, () => props.id], cancel, {flush:'sync'})
onScopeDispose(() => { mounted.value = false; cancel() })
</script>
<template>
  <span v-if="mounted && auth.accessToken && auth.account?.oId" class="chat-repeat">
    <button type="button" title="复读这条消息" aria-label="复读这条消息" :disabled="reading || publication.busy || !!publication.pending" :aria-busy="reading" @click="repeat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/></svg><span>{{ reading ? '…' : '复读' }}</span></button>
    <small v-if="error" role="alert">{{ error }}</small>
  </span>
</template>
<style scoped>
.chat-repeat{display:inline-flex;align-items:center;gap:6px;max-width:100%}.chat-repeat button{display:inline-flex;align-items:center;gap:3px;font:inherit;color:inherit;background:transparent;border:0;padding:2px 0;cursor:pointer}.chat-repeat svg{width:13px;height:13px;flex:none}.chat-repeat button:disabled{opacity:.45;cursor:default}.chat-repeat button:focus-visible{outline:2px solid var(--fp-primary);outline-offset:2px}.chat-repeat small{font-size:11px;color:var(--fp-danger);overflow-wrap:anywhere}
</style>
