<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { readV3UserFollow } from '@/api/v3-user-follow'
import { resolveV3NicknameUser } from '@/api/v3-membership-styles'
import { useAuthStore } from '@/stores/auth'
import { useV3UserFollowStore } from '@/stores/v3UserFollow'
const props = defineProps<{ userName: string }>()
const { accessToken, account } = storeToRefs(useAuthStore()), operations = useV3UserFollowStore()
const mounted = ref(false), targetId = ref(''), following = ref<boolean | null>(null), loading = ref(false), error = ref('')
const visible = computed(() => mounted.value && !!accessToken.value && !!account.value && account.value.userName.toLowerCase() !== props.userName.toLowerCase())
const pending = computed(() => operations.commands[targetId.value])
const label = computed(() => pending.value ? pending.value.busy ? '正在提交…' : pending.value.following ? '重试本次关注' : '重试本次取消关注' : following.value !== null ? following.value ? '取消关注' : '+ 关注' : loading.value ? '读取关注状态…' : '重读关注状态')
let sequence = 0, boundary = ''
function identity() { return `${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId || ''}:${props.userName}` }
function clear() { sequence++; targetId.value = ''; following.value = null; loading.value = false; error.value = '' }
async function load(afterWrite = false) {
  if (!visible.value || loading.value) return
  const current = ++sequence, reader = identity(), name = props.userName
  loading.value = true; error.value = ''; following.value = null
  const valid = () => mounted.value && visible.value && current === sequence && reader === identity()
  try {
    const target = await resolveV3NicknameUser(name)
    if (!valid()) return
    targetId.value = target.id
    if (target.id === account.value?.oId) return
    const state = await readV3UserFollow(target.id)
    if (valid()) following.value = state.following
  } catch (err) { if (valid()) { const message = err instanceof Error ? err.message : '关注状态读取失败'; error.value = afterWrite ? `操作已确认，状态读取失败：${message}` : message } }
  finally { if (valid()) loading.value = false }
}
async function submit() {
  if (!visible.value || !targetId.value || pending.value?.busy || following.value === null && !pending.value) return
  const reader = identity(), desired = pending.value?.following ?? !following.value
  error.value = ''
  try { await operations.set(targetId.value,desired) }
  catch (err) { if (mounted.value && reader === identity()) error.value = err instanceof Error ? err.message : '关注操作失败' }
}
function activate() { if (loading.value || pending.value?.busy) return; if (pending.value || following.value !== null) void submit(); else void load() }
watch([accessToken, () => account.value?.oId, () => props.userName], () => { const next = identity(); if (next === boundary) return; boundary = next; clear(); void load() }, {flush:'sync'})
watch(() => operations.lastChange, change => { if (change.targetId && change.targetId === targetId.value) { clear(); void load(true) } }, {flush:'sync'})
onMounted(() => { mounted.value = true; boundary = identity(); void load() })
onBeforeUnmount(() => { mounted.value = false; clear() })
</script>
<template>
  <span v-if="visible && targetId !== account?.oId" class="user-follow-action">
    <button type="button" :aria-disabled="loading || pending?.busy || undefined" :aria-busy="loading || pending?.busy || undefined" @click="activate">{{ label }}</button>
    <span v-if="error || pending?.error" role="status">{{ error || pending?.error }}</span>
    <span v-if="pending && !pending.busy">上次操作结果待确认，请重试同一次操作。</span>
  </span>
</template>
<style scoped lang="scss">
.user-follow-action { display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center; max-width: 100%; } button { border: 1px solid var(--fp-border); border-radius: 6px; padding: 7px 12px; color: var(--fp-text); background: var(--fp-card); cursor: pointer; } button[aria-disabled='true'] { opacity: .5; cursor: default; } span[role='status'] { color: #c34a36; overflow-wrap: anywhere; }
</style>
