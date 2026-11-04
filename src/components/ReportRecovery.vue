<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyReportRecovery from './LegacyReportRecovery.vue'
import V3ReportRecovery from './V3ReportRecovery.vue'
const legacy=getApiMode()==='v1'

</script>
<template><LegacyReportRecovery v-if="legacy"/><V3ReportRecovery v-else/></template>
