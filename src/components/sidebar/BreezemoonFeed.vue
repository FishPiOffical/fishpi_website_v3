<script setup lang="ts">
import BreezemoonPanel from '@/components/breezemoons/BreezemoonPanel.vue'
withDefaults(defineProps<{avatarOnly?:boolean}>(), { avatarOnly: true })
const emit = defineEmits<{ summary: [text: string] }>()
</script>
<template><BreezemoonPanel :size="6" compact :avatar-only="avatarOnly" @summary="emit('summary', $event)" /></template>
