<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import { RouterLink } from 'vue-router'
import AccountAccessForm from '@/components/account/AccountAccessForm.vue'
import { usePageSeo } from '@/composables/usePageSeo'
usePageSeo(() => ({ title: '注册', path: '/register', robots: 'noindex' }))
</script>
<template><section v-if="getApiMode()==='v1'" class="registration-limit"><h1>注册</h1><p>旧接口未提供完整的注册选项和验证流程，当前模式暂不提供注册。已有账号可直接登录。</p><RouterLink to="/login">前往登录</RouterLink><RouterLink to="/forget-pwd">找回密码</RouterLink></section><AccountAccessForm v-else registration /></template>
<style scoped>.registration-limit{max-width:440px;margin:32px auto;padding:24px;background:var(--fp-card);border:1px solid var(--fp-border);border-radius:10px;line-height:1.7}.registration-limit a{margin-right:16px}</style>
