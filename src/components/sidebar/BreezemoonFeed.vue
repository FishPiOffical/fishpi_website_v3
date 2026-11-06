<script setup lang="ts">
import BreezemoonPanel from '@/components/breezemoons/BreezemoonPanel.vue'
defineProps<{avatarOnly?:boolean}>()
</script>
<template><BreezemoonPanel :size="6" compact :avatar-only="avatarOnly" /></template>
