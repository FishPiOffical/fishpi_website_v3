<script setup lang="ts">
import AccountAccessForm from '@/components/account/AccountAccessForm.vue'
import { usePageSeo } from '@/composables/usePageSeo'
usePageSeo(() => ({ title: '注册', path: '/register', robots: 'noindex' }))
</script>
<template><AccountAccessForm registration /></template>
