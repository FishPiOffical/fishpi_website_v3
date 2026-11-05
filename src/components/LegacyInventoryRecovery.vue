<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getApiMode } from '@/api/mode'
import { useAuthStore } from '@/stores/auth'
import { useLegacyInventoryStore } from '@/stores/legacyInventory'
import { legacyCardLabels } from '@/api/legacy/inventory'
const auth = useAuthStore(), store = useLegacyInventoryStore(), mounted = ref(false)
onMounted(() => { mounted.value = true })
</script>
<template><section v-if="mounted && getApiMode() === 'v1' && auth.apiKey && (store.pending || store.completed || store.error || store.followupError)" class="inventory-recovery" aria-label="旧背包操作提示"><p v-if="store.error" role="alert">{{ store.error }}</p><p v-if="store.followupError" role="alert">{{ store.followupError }}</p><template v-if="store.pending"><p role="status">{{ legacyCardLabels[store.pending.kind] }}使用结果未确认，旧接口不可自动恢复。请核对当前背包与用户名；刷新或退出会丢失本机锁定。</p><RouterLink to="/settings/account">核对背包与用户名</RouterLink><button type="button" :disabled="store.busy" @click="store.release">我已核对，解除背包锁定</button></template><p v-if="store.completed" role="status">{{ legacyCardLabels[store.completed.kind] }}使用已确认；当前背包和用户名请重新读取。</p><button v-if="!store.pending" type="button" :disabled="store.busy" @click="store.dismiss">关闭背包提示</button></section></template>
<style scoped lang="scss">.inventory-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;margin:3px;padding:5px 8px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
