<script setup lang="ts">
import V3OwnerProfileSettings from './V3OwnerProfileSettings.vue'
defineProps<{ mode: 'profile' | 'avatar' }>()
</script>
<template><V3OwnerProfileSettings :mode="mode" /></template>
