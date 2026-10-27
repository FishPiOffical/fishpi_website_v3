<script setup lang="ts">
import AccountAccessForm from '@/components/account/AccountAccessForm.vue'
import { usePageSeo } from '@/composables/usePageSeo'
usePageSeo(() => ({ title: '重置密码', path: '/reset-pwd', robots: 'noindex' }))
</script>
<template><AccountAccessForm received-code /></template>
