<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getApiMode } from '@/api/mode'
import { useAuthStore } from '@/stores/auth'
import { useLegacyPointTransferStore } from '@/stores/legacyPointTransfer'
const auth = useAuthStore(), store = useLegacyPointTransferStore(), mounted = ref(false)
onMounted(() => { mounted.value = true })
</script>
<template><section v-if="mounted && getApiMode() === 'v1' && auth.apiKey && (store.pending || store.completed || store.error)" class="transfer-recovery" aria-label="旧转账操作提示"><p v-if="store.error" role="alert">{{ store.error }}</p><template v-if="store.pending"><p role="status">旧转账结果未确认，不能自动重转。请核对当前余额和积分流水；刷新或退出会清除本机锁定。</p><RouterLink to="/points">核对积分流水</RouterLink><button type="button" :disabled="store.busy" @click="store.release">我已核对，解除转账锁定</button></template><template v-if="store.completed"><p role="status">旧转账请求已确认，当前余额及实际费用请核对积分流水。</p><button type="button" :disabled="store.busy" @click="store.dismiss">关闭转账提示</button></template></section></template>
<style scoped lang="scss">.transfer-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;margin:3px;padding:5px 8px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
