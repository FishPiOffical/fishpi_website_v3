<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PointsView from './PointsView.vue'
const route=useRoute(),auth=useAuthStore(),mounted=ref(false)
const own=computed(()=>mounted.value && auth.isLoggedIn && auth.account?.userName===route.params.userName)
onMounted(()=>{mounted.value=true})
</script>
<template>
  <PointsView v-if="own" embedded />
  <section v-else class="fp-page fp-ui fp-surface">
    <p v-if="!mounted">正在准备本人积分记录…</p>
    <p v-else-if="!auth.isLoggedIn"><RouterLink :to="{path:'/login',query:{redirect:route.fullPath}}">登录后查看本人积分记录</RouterLink></p>
    <p v-else>积分记录仅供本人查看。</p>
  </section>
</template>
