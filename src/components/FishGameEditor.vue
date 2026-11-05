<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import type {FishGame} from '@/api/v3-fish-games'
import LegacyFishGameEditor from './LegacyFishGameEditor.vue'
import V3FishGameEditor from './V3FishGameEditor.vue'
defineProps<{game?:FishGame}>();const emit=defineEmits<{close:[]}>()
</script>
<template><LegacyFishGameEditor v-if="getApiMode()==='v1'" :game="game" @close="emit('close')"/><V3FishGameEditor v-else :game="game" @close="emit('close')"/></template>
