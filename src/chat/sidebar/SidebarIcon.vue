<script setup lang="ts">
import type { ChatSidebarModuleId } from './meta'

defineProps<{ name: ChatSidebarModuleId | 'settings' | 'chevron' }>()
const paths = {
  profile: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  breezemoons: 'M12 3v18M5.5 7.5c2.2 0 3.5 1.4 3.5 3.5M18.5 7.5c-2.2 0-3.5 1.4-3.5 3.5M5 16c2.4-1.3 4.7-1.3 7 0s4.6 1.3 7 0',
  income: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  topic: 'M5 9h14M4 15h14M11 3 7 21M17 3l-4 18',
  online: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  barrage: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM7 9h10M7 13h6',
  appearance: 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.6 1.6 0 0 1 1-2.8h2a4 4 0 0 0 4-4A8.5 8.5 0 0 0 12 3ZM7 10h.01M10 7h.01M15 7h.01M17 10h.01',
  ad: 'M3 4h18v16H3zM3 9h18M8 9v11',
  mutes: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4ZM9 12l2 2 4-4',
  settings: 'M4 7h7M15 7h5M4 17h3M11 17h9M11 4v6M7 14v6',
  chevron: 'm8 10 4 4 4-4',
}
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name]" />
  </svg>
</template>
