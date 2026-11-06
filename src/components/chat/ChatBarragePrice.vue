<script setup lang="ts">
import {onMounted,watch} from 'vue'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatBarragePriceStore} from '@/stores/v3ChatBarragePrice'
const auth=useAuthStore(),store=useV3ChatBarragePriceStore()
onMounted(()=>{void store.read()});watch([()=>auth.accessToken,()=>auth.account?.oId],()=>{void store.read()})
</script>
<template><div class="barrage-price"><p v-if="!auth.accessToken">登录后可查看弹幕价格。</p><p v-else-if="store.loading" role="status">正在读取弹幕价格…</p><p v-else-if="store.error" role="alert">{{ store.error }}</p><p v-else-if="store.price">当前发送花费 {{ store.price.amount }} {{ store.price.unit }}，实际以发送时为准。</p><p v-else>弹幕价格尚未读取。</p><button v-if="auth.accessToken" type="button" :disabled="store.loading" @click="store.read">重新读取价格</button></div></template>
<style scoped lang="scss">.barrage-price{font-size:12px;color:var(--fp-muted)}p{margin:6px 0}button{font:inherit;color:var(--fp-text);background:var(--fp-card);border:1px solid var(--fp-border);border-radius:5px;padding:4px 8px}</style>
