<script setup lang="ts">
import BreezemoonPanel from '@/components/breezemoons/BreezemoonPanel.vue'
withDefaults(defineProps<{avatarOnly?:boolean}>(), { avatarOnly: true })
const emit = defineEmits<{ summary: [text: string] }>()
</script>
<template><BreezemoonPanel :size="8" :preview-limit="6" compact collapsible :avatar-only="avatarOnly" @summary="emit('summary', $event)" /></template>
