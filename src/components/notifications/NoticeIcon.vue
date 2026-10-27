<script setup lang="ts">
import type { NoticeType } from '@/api/fishpi'

defineProps<{ name: NoticeType | 'inbox' | 'check' | 'refresh' | 'chevron' }>()
const paths = {
  other: 'M4 4h16l2 12v4H2v-4L4 4ZM2 14h6l2 3h4l2-3h6',
  commented: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM7 9h10M7 13h6',
  reply: 'm9 5-6 6 6 6M3 11h10a7 7 0 0 1 7 7',
  at: 'M16 8v6a2 2 0 0 0 4 0v-2a8 8 0 1 0-3 6.2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  following: 'M15 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M19 8v6M16 11h6',
  point: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9 8h4a2 2 0 0 1 0 4H9M9 8v9M9 14h5',
  broadcast: 'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 0 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  'sys-announce': 'm3 10 17-6v16L3 14v-4ZM7 15l2 6h4l-2-5M16 6v12',
  inbox: 'M4 4h16l2 12v4H2v-4L4 4ZM2 14h6l2 3h4l2-3h6',
  check: 'm5 12 4 4L19 6',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6',
  chevron: 'm9 5 7 7-7 7',
}
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name]" />
  </svg>
</template>
