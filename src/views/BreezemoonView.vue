<script setup lang="ts">
import ListPageHeading from '@/components/articles/ListPageHeading.vue'
import BreezemoonPanel from '@/components/breezemoons/BreezemoonPanel.vue'
import SideBar from '@/components/SideBar.vue'
import { usePageSeo } from '@/composables/usePageSeo'
usePageSeo(()=>({title:'清风明月',path:'/breezemoons',description:'记录当下的生活与思绪'}))
</script>
<template>
  <div class="fp-page fp-page--wide fp-ui fp-list-page"><main class="content"><section class="module"><ListPageHeading title="清风明月" /><BreezemoonPanel :size="20" manage ssr-scope="global" /></section></main><aside class="side"><SideBar /></aside></div>
</template>
