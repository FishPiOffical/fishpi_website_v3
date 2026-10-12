<script setup lang="ts">
import IncomeCard from '@/components/count/IncomeCard.vue'
</script>

<template>
  <div class="schedule">
    <IncomeCard>
      <span class="hint">调整上下班时间 <span aria-hidden="true">↗</span></span>
    </IncomeCard>
  </div>
</template>

<style scoped>
.schedule :deep(.income) { gap: 6px; border-radius: 5px; }
.schedule :deep(.time) { font-size: 26px; font-weight: 600; line-height: 1.3; letter-spacing: .5px; }
.schedule :deep(.money) { margin-top: 2px; font-size: 12px; font-weight: 500; color: var(--fp-primary); }
.schedule :deep(.money.big) { font-size: 22px; }
.schedule :deep(.income:focus-visible) { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
.hint { display: block; width: 100%; margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--fp-border); color: var(--fp-muted); font-size: 10px; }
.hint > span { float: right; }
</style>
