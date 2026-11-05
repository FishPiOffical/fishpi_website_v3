<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getApiMode } from '@/api/mode'
import { useAuthStore } from '@/stores/auth'
import { useLegacyMedalsStore } from '@/stores/legacyMedals'
const auth = useAuthStore(), store = useLegacyMedalsStore(), mounted = ref(false)
onMounted(() => { mounted.value = true })
</script>
<template><section v-if="mounted && getApiMode() === 'v1' && auth.apiKey && (store.pending || store.completed || store.error)" class="medal-recovery" aria-label="旧勋章操作提示"><p v-if="store.error" role="alert">{{ store.error }}</p><template v-if="store.pending"><p role="status">旧勋章操作结果未确认，无幂等恢复，不能自动重复移动。请核对当前展示状态和顺序。</p><RouterLink to="/settings/account">核对本人勋章</RouterLink><button type="button" :disabled="store.busy" @click="store.release">我已核对，解除勋章锁定</button></template><template v-if="store.completed"><p role="status">勋章操作请求已确认，请以当前列表为准。</p><button type="button" :disabled="store.busy" @click="store.dismiss">关闭勋章提示</button></template></section></template>
<style scoped lang="scss">.medal-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;margin:3px;padding:5px 8px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
