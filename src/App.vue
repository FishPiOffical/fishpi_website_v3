<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useHead, useSeoMeta } from '@unhead/vue'
import AppShell from '@/layouts/AppShell.vue'
import { isNoIndexPath } from '@/seo/ssrRoutes'

const route = useRoute()

useHead({
  htmlAttrs: { lang: 'zh-CN' },
})

useSeoMeta({
  robots: () => {
    if (route.meta.robots) return String(route.meta.robots)
    return isNoIndexPath(route.path) ? 'noindex,nofollow' : 'index,follow'
  },
})
</script>

<template>
  <AppShell />
</template>
