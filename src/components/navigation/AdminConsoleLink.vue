<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{ navigate: [] }>()
const auth = useAuthStore()
const mounted = ref(false)
// 后台仍由 Rhythm 校验经典会话；这里只提供入口，不携带 Bearer 或拼接用户身份。
const href = new URL('/admin', import.meta.env.VITE_BROWSER_API_ORIGIN || import.meta.env.VITE_API_TARGET || 'https://fishpi.cn').href
const visible = computed(() => mounted.value && !!auth.accessToken && auth.account?.capabilities?.canAccessAdmin === true)
onMounted(() => { mounted.value = true })
</script>

<template>
  <a v-if="visible" :href="href" target="_blank" rel="noopener noreferrer" role="menuitem" @click="emit('navigate')">管理后台 ↗</a>
</template>
