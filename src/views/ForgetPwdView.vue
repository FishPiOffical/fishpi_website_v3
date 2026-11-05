<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyPasswordReset from '@/components/account/LegacyPasswordReset.vue'
import AccountAccessForm from '@/components/account/AccountAccessForm.vue'
import { usePageSeo } from '@/composables/usePageSeo'
usePageSeo(() => ({ title: '找回密码', path: '/forget-pwd', robots: 'noindex' }))
</script>
<template><LegacyPasswordReset v-if="getApiMode()==='v1'" /><AccountAccessForm v-else /></template>
