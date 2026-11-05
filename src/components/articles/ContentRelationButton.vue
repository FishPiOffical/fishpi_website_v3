<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import type { ContentRelationKind } from '@/api/v3-content-relations'
import LegacyContentCapability from './LegacyContentCapability.vue'
import V3ContentRelationButton from './V3ContentRelationButton.vue'
defineProps<{ kind:ContentRelationKind;target:string }>()
</script>
<template>
  <LegacyContentCapability v-if="getApiMode()==='v1'" :capability="kind" />
  <V3ContentRelationButton v-else :kind="kind" :target="target" />
</template>
