<script setup lang="ts">
defineProps<{ name: 'game' | 'theme' | 'notice' | 'message' | 'write' }>()

const icons = {
  game: 'playgame',
  theme: 'color-sun',
  notice: 'notification',
  message: 'idleChat',
  write: 'addpost',
}
</script>

<template>
  <svg class="nav-icon" :viewBox="name === 'theme' ? '0 0 24 24' : '0 0 1024 1024'" fill="currentColor" aria-hidden="true">
    <use :href="`/nav-icons.svg#${icons[name]}`" />
  </svg>
</template>

<style scoped>
.nav-icon { display: block; flex: none; width: 19px; height: 19px; }
</style>
