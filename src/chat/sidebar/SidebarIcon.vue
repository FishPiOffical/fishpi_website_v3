<script setup lang="ts">
import type { ChatSidebarModuleId } from './meta'

defineProps<{ name: ChatSidebarModuleId | 'settings' | 'chevron' | 'checkin' | 'download' }>()
const paths = {
  profile: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  // 风绕月使用 20px 画布，月牙与两道风线留出间隙，避免小尺寸下粘连。
  breezemoons: 'M11.6 2.2c3.8 0 6.6 2.7 6.6 6.1 0 3.3-3.3 6.6-8.3 4.3 3.6-.1 5.2-2.9 4.6-5.7-.3-2-1.5-3.6-2.9-4.7ZM1.8 14.6c3-2.1 5.2-.9 7.7.4M3 18c2.7-1.8 4.6.9 7.4-.2',
  income: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  topic: 'M5 9h14M4 15h14M11 3 7 21M17 3l-4 18',
  online: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  appearance: 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.6 1.6 0 0 1 1-2.8h2a4 4 0 0 0 4-4A8.5 8.5 0 0 0 12 3ZM7 10h.01M10 7h.01M15 7h.01M17 10h.01',
  ad: 'M3 4h18v16H3zM3 9h18M8 9v11',
  mutes: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4ZM9 12l2 2 4-4',
  checkin: 'M8 3v4m8-4v4M4 10h16m-11 5 2 2 4-4M4 6h16v14H4z',
  download: 'M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4',
  settings: 'M10 3h4l.6 2.4 2 .9 2.2-1.1 2 3.5-1.7 1.8v3l1.7 1.8-2 3.5-2.2-1.1-2 .9L14 21h-4l-.6-2.4-2-.9-2.2 1.1-2-3.5 1.7-1.8v-3L3.2 8.7l2-3.5 2.2 1.1 2-.9L10 3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  chevron: 'm8 10 4 4 4-4',
}
</script>

<template>
  <svg :viewBox="name === 'breezemoons' ? '0 0 20 20' : '0 0 24 24'" :data-icon="name" :width="name === 'breezemoons' ? 20 : undefined" :height="name === 'breezemoons' ? 20 : undefined" fill="none" stroke="currentColor" :stroke-width="name === 'breezemoons' ? 1.5 : 1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path :d="paths[name]" />
  </svg>
</template>
