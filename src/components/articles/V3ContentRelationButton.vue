<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { readContentRelation, resolveContentRelationTarget, type ContentRelationKind } from '@/api/v3-content-relations'
import { useAuthStore } from '@/stores/auth'
import { useV3ContentRelationsStore } from '@/stores/v3ContentRelations'
const props = defineProps<{ kind:ContentRelationKind;target:string }>()
const { accessToken, account } = storeToRefs(useAuthStore()), operations = useV3ContentRelationsStore()
const mounted = ref(false), targetId = ref(''), following = ref<boolean | null>(null), loading = ref(false), error = ref('')
const visible = computed(() => mounted.value && !!accessToken.value && !!account.value)
const pending = computed(() => operations.commands[props.kind+':'+targetId.value])
const action=computed(()=>props.kind==='tag'?'关注标签':props.kind==='collection'?'收藏':'订阅')
const label=computed(()=>pending.value?pending.value.busy?'正在提交…':`重试本次${pending.value.following?'':'取消'}${action.value}`:following.value!==null?`${following.value?'取消':''}${action.value}`:loading.value?'读取状态…':'重读状态')
let sequence = 0, boundary = ''
function identity() { return `${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId || ''}:${props.kind}:${props.target}` }
function clear(keepTarget=false) { sequence++; if(!keepTarget)targetId.value = ''; following.value = null; loading.value = false; error.value = '' }
async function load(afterWrite = false) {
  if (!visible.value || loading.value) return
  const current = ++sequence, reader = identity(), target = props.target, kind=props.kind
  loading.value = true; error.value = ''; following.value = null
  const valid = () => mounted.value && visible.value && current === sequence && reader === identity()
  try {
    const resolved = targetId.value || await resolveContentRelationTarget(kind,target)
    if (!valid()) return
    targetId.value = resolved
    const state = await readContentRelation(kind,resolved)
    if (valid()) following.value = state.following
  } catch (err) { if (valid()) { const message = err instanceof Error ? err.message : '状态读取失败'; error.value = afterWrite ? `操作已确认，状态读取失败：${message}` : message } }
  finally { if (valid()) loading.value = false }
}
async function submit() {
  if (!visible.value || !targetId.value || pending.value?.busy || following.value === null && !pending.value) return
  const reader = identity(), desired = pending.value?.following ?? !following.value
  error.value = ''
  try { await operations.set(props.kind,targetId.value,desired) }
  catch (err) { if (mounted.value && reader === identity()) error.value = err instanceof Error ? err.message : '关系操作失败' }
}
function activate() { if (loading.value || pending.value?.busy) return; if (pending.value || following.value !== null) void submit(); else void load() }
watch([accessToken, () => account.value?.oId, () => props.target, () => props.kind], () => { const next = identity(); if (next === boundary) return; boundary = next; clear(); void load() }, {flush:'sync'})
watch(() => operations.lastChange, change => { if (change.kind===props.kind && change.targetId && change.targetId === targetId.value) { clear(true); void load(true) } }, {flush:'sync'})
onMounted(() => { mounted.value = true; boundary = identity(); void load() })
onBeforeUnmount(() => { mounted.value = false; clear() })
</script>
<template>
  <span v-if="visible" class="content-relation-action">
    <button type="button" :aria-disabled="loading || pending?.busy || undefined" :aria-busy="loading || pending?.busy || undefined" @click="activate">{{ label }}</button>
    <span v-if="error || pending?.error" role="status">{{ error || pending?.error }}</span>
    <span v-if="pending && !pending.busy">上次操作结果待确认，请重试同一次操作。</span>
  </span>
</template>
<style scoped lang="scss">
.content-relation-action { display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center; max-width: 100%; } button { border: 1px solid var(--fp-border); border-radius: 6px; padding: 7px 12px; color: var(--fp-text); background: var(--fp-card); cursor: pointer; } button[aria-disabled='true'] { opacity: .5; cursor: default; } span[role='status'] { color: #c34a36; overflow-wrap: anywhere; }
</style>
