<script setup lang="ts">
import {onMounted,watch} from 'vue'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatBarragePriceStore} from '@/stores/v3ChatBarragePrice'
const auth=useAuthStore(),store=useV3ChatBarragePriceStore()
onMounted(()=>{void store.read()});watch([()=>auth.accessToken,()=>auth.account?.oId],()=>{void store.read()})
</script>
<template>
  <div class="barrage-price">
    <span v-if="!auth.accessToken">登录后可发送</span>
    <span v-else-if="store.loading" role="status">读取价格中…</span>
    <template v-else-if="!store.price">
      <span role="status">价格暂不可用</span>
      <button type="button" aria-label="重新读取弹幕价格" @click="store.read">重试</button>
    </template>
    <span v-else title="实际扣费以发送时为准">本次预计 {{ store.price.amount }} {{ store.price.unit }}</span>
  </div>
</template>

<style scoped>
.barrage-price { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fp-muted); }
</style>
