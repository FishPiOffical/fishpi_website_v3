<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useHead, useSeoMeta } from '@unhead/vue'
import { useLocalBrandingStore } from '@/stores/localBranding'
import AppShell from '@/layouts/AppShell.vue'
import { isNoIndexPath } from '@/seo/ssrRoutes'

const route = useRoute()
const branding = useLocalBrandingStore()

useHead({
  htmlAttrs: { lang: 'zh-CN' },
  titleTemplate: title => branding.name || title || '摸鱼派',
  link: () => [{ rel: 'icon', href: branding.logo || '/logo.png' }],
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
