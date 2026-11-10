<script setup lang="ts">
import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { fetchMedalImage } from '@/api/v3-medal-images'
const props = withDefaults(defineProps<{ id: string; name: string; owner?: boolean; userName?: string; mini?: boolean; showName?: boolean }>(), { owner: false, userName: '', mini: false, showName: true })
const auth = useAuthStore(), source = ref(''), loading = ref(false), error = ref('')
let mounted = false, seq = 0, pending: AbortController | null = null
function clear() { seq++; pending?.abort(); pending = null; if (source.value) URL.revokeObjectURL(source.value); source.value = ''; loading.value = false; error.value = '' }
async function load() {
  clear()
  if (!mounted || import.meta.env.SSR || (props.owner ? !auth.accessToken || !auth.account?.oId : !props.userName)) return
  const version = getAuthContextVersion(), run = seq, token = auth.accessToken, actor = auth.account?.oId
  const controller = pending = new AbortController()
  const valid = () => mounted && run === seq && version === getAuthContextVersion() && token === auth.accessToken && actor === auth.account?.oId
  loading.value = true
  try { const blob = await fetchMedalImage(props.id, props.owner ? '' : props.userName, props.mini, controller.signal); if (valid() && blob) source.value = URL.createObjectURL(blob) }
  catch (e) { if (valid()) error.value = e instanceof Error ? e.message : '图片读取失败' }
  finally { if (valid()) { loading.value = false; pending = null } }
}
function failed() { clear(); error.value = '勋章图片无法显示' }
onMounted(() => { mounted = true; void load() })
watch([() => auth.accessToken, () => auth.account?.oId, () => props.id, () => props.userName, () => props.owner, () => props.mini], () => void load(), { flush: 'sync' })
onScopeDispose(() => { mounted = false; clear() })
</script>
<template><span class="v3-medal-image"><img v-if="source" :src="source" :alt="name || '勋章'" :class="{ mini }" @error="failed" /><span v-else-if="showName">{{ name }}</span><small v-if="loading" role="status">图片读取中…</small><span v-if="error" class="image-error"><small role="alert">{{ error }}</small><button type="button" @click="load">重试勋章图片</button></span></span></template>
<style scoped lang="scss">
.v3-medal-image { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 5px; max-width: 100%; overflow-wrap: anywhere; img { height: 28px; max-width: 100%; object-fit: contain; &.mini { height: 25px; } } small { color: var(--fp-muted); } button { border: 1px solid var(--fp-border); background: var(--fp-card); color: var(--fp-text); border-radius: 4px; cursor: pointer; } }
.image-error { display: inline-flex; flex-wrap: wrap; gap: 5px; align-items: center; }
</style>
