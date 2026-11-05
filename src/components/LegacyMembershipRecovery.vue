<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getApiMode } from '@/api/mode'
import { useAuthStore } from '@/stores/auth'
import { useLegacyMembershipStore } from '@/stores/legacyMembership'
const auth = useAuthStore(), store = useLegacyMembershipStore(), mounted = ref(false)
onMounted(() => { mounted.value = true })
</script>
<template><section v-if="mounted && getApiMode() === 'v1' && auth.apiKey && (store.pending || store.completed || store.error)" class="membership-recovery" aria-label="旧会员操作提示"><p v-if="store.error" role="alert">{{ store.error }}</p><template v-if="store.pending"><p>旧会员操作结果未确认，不能自动重发；请先核对会员状态、背包和积分流水。</p><RouterLink to="/vips">核对会员状态</RouterLink><RouterLink to="/points">查看积分流水</RouterLink><button type="button" :disabled="store.busy" @click="store.release">我已核对，解除会员锁定</button></template><template v-if="store.completed"><p>会员操作请求已确认，请以当前状态为准。</p><button type="button" :disabled="store.busy" @click="store.dismiss">关闭会员提示</button></template></section></template>
<style scoped lang="scss">.membership-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button,a{font:inherit;margin:3px;padding:5px 8px}button{border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
