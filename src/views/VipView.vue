<script setup lang="ts">
import OwnerMembership from '@/components/settings/OwnerMembership.vue'
import { usePageSeo } from '@/composables/usePageSeo'
usePageSeo(() => ({ title: '摸鱼派 VIP', path: '/vips', robots: 'noindex' }))
</script>

<template>
  <OwnerMembership />
</template>
