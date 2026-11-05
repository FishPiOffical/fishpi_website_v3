<script setup lang="ts">
import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { fetchLegacyOwnerProfile, type LegacyOwnerProfile } from '@/api/legacy/owner-profile'
const props = defineProps<{ mode: 'profile' | 'avatar' }>()
const auth = useAuthStore(), profile = ref<LegacyOwnerProfile | null>(null), loading = ref(false), error = ref(''), imageError = ref(false)
let mounted = false, sequence = 0
function identity() { return JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId]) }
function clear() { sequence++; profile.value = null; loading.value = false; error.value = ''; imageError.value = false }
async function read() {
  if (!mounted || import.meta.env.SSR || !auth.apiKey || !auth.account?.oId) return
  clear()
  const run = sequence, owner = auth.account.oId, reader = identity(), mode = props.mode
  const valid = () => mounted && run === sequence && reader === identity() && mode === props.mode
  loading.value = true
  try { const value = await fetchLegacyOwnerProfile(owner); if (valid()) profile.value = value }
  catch (failure) { if (valid()) error.value = failure instanceof Error ? failure.message : '本人资料读取失败' }
  finally { if (valid()) loading.value = false }
}
watch([identity, () => props.mode], () => { clear(); void read() }, { flush: 'sync' })
onMounted(() => { mounted = true; void read() })
onScopeDispose(() => { mounted = false; clear() })
</script>
<template>
  <section class="legacy-owner-profile" :aria-label="mode === 'avatar' ? '本人头像' : '本人资料'">
    <p class="hint">当前可查看本人资料。旧版资料保存会同时覆盖 QQ、标签和 MBTI，但本人读取接口缺少这些原值；头像修改仍依赖经典页面会话，此处暂不提供修改操作。</p>
    <p v-if="loading" role="status">正在读取本人资料…</p><p v-if="error" role="alert" class="error">{{ error }}</p>
    <template v-if="profile">
      <template v-if="mode === 'avatar'"><img v-if="profile.avatar && !imageError" :src="profile.avatar" alt="当前本人头像" referrerpolicy="no-referrer" @error="imageError = true" /><p v-if="imageError" role="alert">当前头像图片无法显示。</p><p v-if="!profile.avatar">尚未设置头像地址。</p><p class="avatar-url">当前头像地址：{{ profile.avatar || '未设置' }}</p></template>
      <template v-else><dl><dt>用户名</dt><dd>{{ profile.userName }}</dd><dt>昵称</dt><dd>{{ profile.nickname || '未设置' }}</dd><dt>简介</dt><dd>{{ profile.intro || '未设置' }}</dd><dt>个人网址</dt><dd>{{ profile.website || '未设置' }}</dd></dl><p class="hint">旧本人接口未提供 QQ、个人标签和 MBTI 的编辑数据，当前不能读取或保存这些项目。</p></template>
    </template>
    <button type="button" :disabled="loading" @click="read">重新读取本人资料</button>
  </section>
</template>
<style scoped lang="scss">
.legacy-owner-profile { margin: 16px 0; } dl { display: grid; grid-template-columns: 90px minmax(0,1fr); gap: 14px; } dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; } img { width: 120px; height: 120px; object-fit: cover; border-radius: 12px; } .avatar-url { overflow-wrap: anywhere; } .hint { color: var(--fp-muted); font-size: 13px; } .error { color: #c34a36; } button { border: 1px solid var(--fp-border); background: transparent; color: var(--fp-text); border-radius: 8px; padding: 8px 12px; cursor: pointer; }
</style>
