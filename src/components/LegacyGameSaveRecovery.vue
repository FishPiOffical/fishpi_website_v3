<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getApiMode } from '@/api/mode'
import { useAuthStore } from '@/stores/auth'
import { useLegacyGameSavesStore } from '@/stores/legacyGameSaves'
const auth = useAuthStore(), store = useLegacyGameSavesStore(), mounted = ref(false)
onMounted(() => { mounted.value = true })
</script>
<template><section v-if="mounted && getApiMode() === 'v1' && auth.apiKey && (store.pending || store.completed || store.error)" class="game-save-recovery" aria-label="旧存档操作提示"><p v-if="store.error" role="alert">{{ store.error }}</p><template v-if="store.pending"><p>旧存档保存结果未确认，不能自动重复覆盖；请先读取当前云存档核对。</p><RouterLink to="/settings/data">核对本人存档</RouterLink><button type="button" :disabled="store.busy" @click="store.release">我已核对，解除存档锁定</button></template><template v-if="store.completed"><p>存档保存请求已确认，当前内容请重新读取。</p><button type="button" :disabled="store.busy" @click="store.dismiss">关闭存档提示</button></template></section></template>
<style scoped lang="scss">.game-save-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button,a{font:inherit;margin:3px;padding:5px 8px}button{border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
