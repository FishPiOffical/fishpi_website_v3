<script setup lang="ts">
import BreezemoonFeed from '@/components/sidebar/BreezemoonFeed.vue'
const emit = defineEmits<{ summary: [text: string] }>()
</script>

<template>
  <BreezemoonFeed avatar-only @summary="emit('summary', $event)" />
</template>
