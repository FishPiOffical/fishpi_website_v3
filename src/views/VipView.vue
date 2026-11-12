<script setup lang="ts">
import OwnerMembership from '@/components/settings/OwnerMembership.vue'
import { usePageSeo } from '@/composables/usePageSeo'
usePageSeo(() => ({ title: '摸鱼派 VIP', path: '/vips', robots: 'noindex' }))
</script>

<template>
  <div class="fp-page fp-ui vip-page"><OwnerMembership /></div>
</template>

<style scoped>
.vip-page { max-width: 1240px; margin-inline: auto; }
</style>
