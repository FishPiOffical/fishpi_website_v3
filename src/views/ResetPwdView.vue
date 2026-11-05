<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyPasswordReset from '@/components/account/LegacyPasswordReset.vue'
import AccountAccessForm from '@/components/account/AccountAccessForm.vue'
import { usePageSeo } from '@/composables/usePageSeo'
usePageSeo(() => ({ title: '重置密码', path: '/reset-pwd', robots: 'noindex' }))
</script>
<template><LegacyPasswordReset v-if="getApiMode()==='v1'" received-code /><AccountAccessForm v-else received-code /></template>
