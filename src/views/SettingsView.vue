<script setup lang="ts">
import AppearancePicker from '@/components/packs/AppearancePicker.vue'
</script>

<template>
  <div class="card">
    <h1>外观</h1>
    <p>主题免费。对话框和头像框的进阶样式后期仅 VIP 可用。</p>
    <AppearancePicker />
  </div>
</template>

<style scoped>
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 24px;
  max-width: 720px;
}
p {
  color: var(--fp-muted);
  font-size: 13px;
}
</style>
