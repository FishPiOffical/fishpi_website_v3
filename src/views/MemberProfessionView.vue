<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PublicProfessions from '@/components/profession/PublicProfessions.vue'
import { usePageSeo } from '@/composables/usePageSeo'

const route = useRoute()
const name = computed(() => String(route.params.userName ?? ''))
usePageSeo(() => ({ title: `${name.value} 的职业动态`, path: route.path }))
</script>

<template>
  <section class="fp-surface">
    <h1>职业动态</h1>
    <PublicProfessions :user-name="name" />
  </section>
</template>

<style scoped>
h1 { margin: 0 0 12px; font-size: 20px; }
</style>
