<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyActivityRecovery from './LegacyActivityRecovery.vue'
import V3ActivityRecovery from './V3ActivityRecovery.vue'
</script>
<template><LegacyActivityRecovery v-if="getApiMode()==='v1'"/><V3ActivityRecovery v-else/></template>
