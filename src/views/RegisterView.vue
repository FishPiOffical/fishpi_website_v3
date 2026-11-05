<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyRegistration from '@/components/account/LegacyRegistration.vue'
import AccountAccessForm from '@/components/account/AccountAccessForm.vue'
import { usePageSeo } from '@/composables/usePageSeo'
usePageSeo(() => ({ title: '注册', path: '/register', robots: 'noindex' }))
</script>
<template><LegacyRegistration v-if="getApiMode()==='v1'" /><AccountAccessForm v-else registration /></template>
