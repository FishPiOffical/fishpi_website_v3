<script setup lang="ts">
import {onMounted,ref} from 'vue'
import {RouterLink} from 'vue-router'
import {getApiMode} from '@/api/mode'
import {useAuthStore} from '@/stores/auth'
import {useLegacyArticleRewardStore} from '@/stores/legacyArticleReward'
const auth=useAuthStore(),store=useLegacyArticleRewardStore(),mounted=ref(false)
onMounted(()=>{mounted.value=true})
</script>
<template><section v-if="mounted&&getApiMode()==='v1'&&auth.apiKey&&store.pending" class="reward-recovery" aria-label="旧文章打赏核对"><p>{{ store.busy?'正在处理文章打赏…':'打赏结果待核对，请勿重复购买。' }} 文章 {{ store.pending.id }}，提交前价格 {{ store.pending.price }} 积分。刷新页面或退出会丢失本机记录，请先核对。</p><RouterLink :to="'/article/'+store.pending.id">核对解锁状态</RouterLink><RouterLink to="/points">查看积分流水</RouterLink><button type="button" :disabled="store.busy" @click="store.release">我已核对，解除打赏锁定</button></section></template>
<style scoped lang="scss">.reward-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}button,a{font:inherit;margin:3px;padding:5px 8px}button{border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
