<script setup lang="ts">
import BreezemoonPanel from '@/components/breezemoons/BreezemoonPanel.vue'
import SideBar from '@/components/SideBar.vue'
import { usePageSeo } from '@/composables/usePageSeo'
usePageSeo(()=>({title:'清风明月',path:'/breezemoons',description:'记录当下的生活与思绪'}))
</script>
<template>
  <div class="wrapper list-page-wrap"><main class="content"><section class="module"><header><h1>清风明月</h1><p>记录当下的生活与思绪</p></header><BreezemoonPanel :size="20" manage ssr-scope="global" /></section></main><aside class="side"><SideBar /></aside></div>
</template>
<style scoped lang="scss">
header { padding: 16px 18px; border-bottom: 1px solid var(--fp-border); } h1 { margin: 0 0 6px; font-size: 20px; } header p { margin: 0; color: var(--fp-muted); }
</style>
