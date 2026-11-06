<script setup lang="ts">
import BreezemoonPanel from '@/components/breezemoons/BreezemoonPanel.vue'
withDefaults(defineProps<{avatarOnly?:boolean}>(), { avatarOnly: true })
</script>
<template><BreezemoonPanel :size="6" compact :avatar-only="avatarOnly" /></template>
