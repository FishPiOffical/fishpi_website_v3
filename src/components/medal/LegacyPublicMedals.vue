<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { fetchLegacyPublicMedals, type LegacyPublicMedal } from '@/api/legacy/public-medals'
import { usePageSeo } from '@/composables/usePageSeo'
const route = useRoute(), auth = useAuthStore(), name = computed(() => String(route.params.userName || ''))
const medals = ref<LegacyPublicMedal[] | null>(null), loading = ref(false), error = ref(''), p = ref(1), imageErrors = ref(new Set<number>())
const pages = computed(() => Math.max(1, Math.ceil((medals.value?.length || 0) / 20)))
const visible = computed(() => medals.value?.slice((p.value - 1) * 20, p.value * 20) || [])
let mounted = false, sequence = 0
function clear() { sequence++; medals.value = null; loading.value = false; error.value = ''; imageErrors.value = new Set() }
async function read() {
  if (!mounted || import.meta.env.SSR) return
  clear(); p.value = 1
  const run = sequence, target = name.value, key = auth.apiKey, actor = auth.account?.oId, context = getAuthContextVersion()
  const valid = () => mounted && run === sequence && target === name.value && key === auth.apiKey && actor === auth.account?.oId && context === getAuthContextVersion()
  loading.value = true
  try { const result = await fetchLegacyPublicMedals(target); if (valid()) medals.value = result }
  catch (failure) { if (valid()) error.value = failure instanceof Error ? failure.message : '公开勋章读取失败' }
  finally { if (valid()) loading.value = false }
}
function failed(index: number) { imageErrors.value.add((p.value - 1) * 20 + index) }
onMounted(() => { mounted = true; void read() })
watch([name, () => auth.apiKey, () => auth.account?.oId], () => { clear(); p.value = 1; void read() }, { flush: 'sync' })
onScopeDispose(() => { mounted = false; clear() })
usePageSeo(() => ({ title: `${name.value} 的公开勋章`, path: `/member/${encodeURIComponent(name.value)}/medals`, description: `${name.value} 当前公开展示的勋章` }))
</script>
<template>
  <section class="public-medals">
    <h1><RouterLink :to="`/member/${encodeURIComponent(name)}`">{{ name }}</RouterLink> 的公开勋章</h1>
    <p>当前公开展示的勋章；仅展示当前快照，不包含历史授予记录。</p>
    <button type="button" :disabled="loading" @click="read">刷新公开勋章</button>
    <p v-if="loading" role="status">正在读取公开勋章…</p>
    <div v-else-if="error" role="alert"><p>{{ error }}</p><button type="button" @click="read">重试公开勋章</button></div>
    <template v-else-if="medals">
      <p>当前快照 {{ medals.length }} 枚公开勋章</p>
      <ul class="medal-list"><li v-for="(medal, index) in visible" :key="`${p}:${index}`">
        <img v-if="medal.imageURL && !imageErrors.has((p - 1) * 20 + index)" :src="medal.imageURL" :alt="medal.name" crossorigin="anonymous" referrerpolicy="no-referrer" loading="lazy" @error="failed(index)" />
        <small v-if="imageErrors.has((p - 1) * 20 + index)">勋章图片无法显示</small>
        <strong>{{ medal.name }}</strong><span v-if="medal.type" class="medal-type">{{ medal.type }}</span><p>{{ medal.description }}</p><small>显示有效期：{{ medal.expiresOn }}</small>
      </li></ul>
      <p v-if="!medals.length">当前没有公开展示的勋章。</p>
      <div v-if="pages > 1" class="medal-pager"><button type="button" :disabled="p <= 1" @click="p--">上一页勋章</button><span>当前快照第 {{ p }} / {{ pages }} 页</span><button type="button" :disabled="p >= pages" @click="p++">下一页勋章</button></div>
    </template>
    <p v-else role="status">公开勋章尚未读取。</p>
  </section>
</template>
<style scoped lang="scss" src="./public-medals.scss"></style>
