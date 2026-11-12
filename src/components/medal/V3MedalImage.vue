<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
const props = withDefaults(defineProps<{ id: string; name: string; owner?: boolean; userName?: string; mini?: boolean; showName?: boolean; quiet?: boolean }>(), { owner: false, userName: '', mini: false, showName: true, quiet: false })
const auth = useAuthStore(), mounted = ref(false), failed = ref(false)
const ready = computed(() => mounted.value && auth.isLoggedIn)
// 旧站图片只使用浏览器已有的旧站 Cookie；不把 V3 Bearer 放入 URL。
const source = computed(() => {
  const query = new URLSearchParams(props.id ? { id: props.id } : { name: props.name })
  if (props.mini) query.set('mini', 'yes')
  return `https://fishpi.cn/gen?${query}`
})
function loaded(event: Event) {
  const image = event.target as HTMLImageElement
  if (!image.naturalWidth || !image.naturalHeight) failed.value = true
}
watch([source, () => auth.account?.oId, ready], () => { failed.value = false })
onMounted(() => { mounted.value = true })
</script>
<template>
  <span v-if="ready" class="v3-medal-image">
    <img v-if="!failed && (id || name)" :key="source" :src="source" :alt="name || '勋章'" :class="{ mini }" @load="loaded" @error="failed=true" />
    <span v-else-if="showName" :title="quiet ? '需登录旧站后查看勋章图片' : undefined">{{ name }}</span>
    <small v-if="failed && !quiet">需登录旧站后查看勋章图片</small>
  </span>
</template>
<style scoped lang="scss">
.v3-medal-image { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 5px; max-width: 100%; overflow-wrap: anywhere; img { height: 28px; max-width: 100%; object-fit: contain; &.mini { height: 25px; } } small { color: var(--fp-muted); } button { border: 1px solid var(--fp-border); background: var(--fp-card); color: var(--fp-text); border-radius: 4px; cursor: pointer; } }
.image-error { display: inline-flex; flex-wrap: wrap; gap: 5px; align-items: center; }
</style>
