<script setup lang="ts">
defineProps<{ name: 'feed' | 'water' | 'pet' | 'play' | 'rest' | 'wake' | 'coin' | 'gift' | 'bag' | 'edit' | 'close' | 'minus' | 'move' | 'refresh' | 'home' | 'check' | 'outing' | 'course' | 'work' | 'clock' | 'growth' | 'history' | 'chevron' | 'shop' | 'craft' | 'collection' | 'material' | 'care' | 'purchase' | 'lock' }>()
const paths = {
  feed: 'M4 12h16c0 5-3 8-8 8s-8-3-8-8Zm2-4h.01M12 5h.01M17 8h.01',
  water: 'M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12ZM8 15a4 4 0 0 0 4 4',
  pet: 'M12 20s-9-5-9-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 11-9 11Z',
  play: 'M8 8h8c3 0 4 2 5 8 1 4-3 4-5 0H8c-2 4-6 4-5 0 1-6 2-8 5-8ZM7 11v4m-2-2h4m7-1h.01m2 2h.01',
  rest: 'M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z',
  wake: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  coin: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 8h4a3 3 0 0 1 0 6h-3m0-6v10',
  gift: 'M3 8h18v4H3Zm2 4v9h14v-9M12 8v13m0-13H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z',
  bag: 'M6 6h12l2 15H4L6 6Zm3 0V5a3 3 0 0 1 6 0v1m-6 6h6',
  edit: 'm14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-4L4 15v5Z',
  close: 'm6 6 12 12M6 18 18 6',
  minus: 'M5 12h14',
  move: 'M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2',
  home: 'm3 10 9-7 9 7v11H3V10Zm6 11v-8h6v8',
  check: 'm5 12 4 4L19 6',
  outing: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-6-3-2 4-4 2 2-4 4-2Z',
  course: 'M12 5v16M3 4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3V4Z',
  work: 'M8 7V4h8v3M3 7h18v13H3V7Zm0 5a22 22 0 0 0 18 0M10 12h4v3h-4v-3Z',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  growth: 'M12 21V11m0 5C5 16 3 12 3 7c6 0 9 3 9 9Zm0-5c0-5 3-8 9-8 0 5-3 8-9 8Z',
  history: 'M3 11a9 9 0 1 1 2.6 7.3M3 5v6h6m3-4v5l3 2',
  chevron: 'm9 5 7 7-7 7',
  shop: 'M4 9v12h16V9M3 9l2-6h14l2 6M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 21v-7h6v7',
  craft: 'm14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-4L4 15v5ZM4 4l4 4m-4-4v4m0-4h4',
  collection: 'M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 15v6m-4 0h8',
  material: 'M20 3C10 2 3 6 4 13a7 7 0 0 0 7 7c7 1 11-7 9-17ZM3 21 15 9',
  care: 'M12 20s-9-5-9-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 11-9 11Z',
  purchase: 'M6 6h12l2 15H4L6 6Zm3 0V5a3 3 0 0 1 6 0v1m-6 6h6',
  lock: 'M5 10h14v11H5V10Zm3 0V7a4 4 0 0 1 8 0v3m-4 4v3',
}
</script>
<template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name]" /></svg></template>
<style scoped>svg { width: 20px; height: 20px; flex: none; }</style>
