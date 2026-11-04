<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyReportDialog from './LegacyReportDialog.vue'
import V3ReportDialog from './V3ReportDialog.vue'
const legacy=getApiMode()==='v1'
defineProps<{dataId:string;dataType:number}>()
</script>
<template><LegacyReportDialog v-if="legacy" :data-id="dataId" :data-type="dataType"/><V3ReportDialog v-else :data-id="dataId" :data-type="dataType"/></template>
