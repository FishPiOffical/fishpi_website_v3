<script setup lang="ts">
import AccountAccessForm from '@/components/account/AccountAccessForm.vue'
import { usePageSeo } from '@/composables/usePageSeo'
usePageSeo(() => ({ title: '找回密码', path: '/forget-pwd', robots: 'noindex' }))
</script>
<template><AccountAccessForm  /></template>
