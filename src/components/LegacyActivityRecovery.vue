<script setup lang="ts">
import {RouterLink} from 'vue-router'
import {useAuthStore} from '@/stores/auth'
import {useLegacyActivityStore} from '@/stores/legacyActivity'
const auth=useAuthStore(),store=useLegacyActivityStore()
</script>
<template><div v-if="auth.apiKey&&(store.pending||store.receipt||store.error)" class="activity-recovery"><p v-if="store.error" role="alert">{{ store.error }}</p><template v-if="store.pending"><p role="status">旧奖励领取结果未确认，无幂等回执，请核对奖励状态及积分流水后再决定；刷新或退出会丢失本机锁定。</p><RouterLink to="/points">查看积分流水</RouterLink><button type="button" :disabled="store.busy" @click="store.release">我已核对，解除锁定</button></template><p v-if="store.receipt" role="status">{{ store.receipt.awarded?`本次领取返回 ${store.receipt.amount} 积分，请以当前余额和流水核对。`:'本次没有发放奖励，可能已领取、不满足条件或旧服务发放失败；请重新读取当前状态。' }}</p><button v-if="!store.pending&&!store.busy" type="button" @click="store.dismiss">关闭活动提示</button></div></template>
<style scoped lang="scss">.activity-recovery{max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}button{font:inherit;margin:3px;padding:5px 8px;background:var(--fp-card);color:var(--fp-text);border:1px solid var(--fp-border);border-radius:5px}[role=alert]{color:#bd503c}</style>
