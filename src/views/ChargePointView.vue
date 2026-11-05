<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import { RouterLink } from 'vue-router'
import { usePageSeo } from '@/composables/usePageSeo'
import V3ChargePointView from './V3ChargePointView.vue'
if(getApiMode()==='v1')usePageSeo(() => ({ title:'捐助摸鱼派',path:'/charge/point',robots:'noindex' }))
</script>
<template>
  <section v-if="getApiMode()==='v1'" class="donation-page">
    <h1>❤️ 捐助摸鱼派</h1>
    <p role="status">当前 v1 接口未提供本站所需的捐助页面配置，暂不提供支付入口。</p>
    <p class="hint">其他积分功能可通过下方入口使用。</p>
    <nav aria-label="相关积分功能"><RouterLink to="/vips">开通 VIP</RouterLink><RouterLink to="/settings/point">积分转账</RouterLink><RouterLink to="/points">积分流水</RouterLink></nav>
  </section>
  <V3ChargePointView v-else />
</template>
<style scoped lang="scss">
.donation-page { max-width: 560px; margin: 24px auto; padding: 22px 24px; display: grid; gap: 16px; } h1 { margin: 0; font-size: 20px; color: var(--fp-title); } p { margin: 0; line-height: 1.6; color: var(--fp-text); } .hint { color: var(--fp-muted); } .address { overflow-wrap: anywhere; font-size: 13px; } .error { color: #c34a36; } button { justify-self: start; padding: 8px 12px; background: transparent; color: var(--fp-text); border: 1px solid var(--fp-border); border-radius: 8px; cursor: pointer; } button:disabled { opacity: .5; cursor: default; } a { color: var(--fp-link); } nav { display: flex; flex-wrap: wrap; gap: 14px; }
</style>
