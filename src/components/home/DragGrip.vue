<template>
  <svg class="drag-grip" viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
    <circle v-for="n in 9" :key="n" :cx="4 + ((n - 1) % 3) * 6" :cy="4 + Math.floor((n - 1) / 3) * 6" r="1.5" />
  </svg>
</template>

<style scoped>
.drag-grip { display: inline-block; flex: none; vertical-align: middle; }
</style>
