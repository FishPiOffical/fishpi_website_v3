<script setup lang="ts">
import type { AdSlotKey } from '@/types/ads'

defineProps<{ slotKey: AdSlotKey }>()
</script>

<template>
  <!-- 广告位入口：占位 data-slot，暂不渲染素材 -->
  <div class="slot" :data-slot="slotKey" data-ad-entry hidden aria-hidden="true" />
</template>
