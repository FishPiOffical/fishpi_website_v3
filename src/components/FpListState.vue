<script setup lang="ts">
defineProps<{
  message: string
  kind?: 'empty' | 'loading' | 'error'
}>()
</script>

<template>
  <div class="fp-state">
    <p :role="kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined">{{ message }}</p>
    <div v-if="$slots.actions" class="fp-state-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
[role='alert'] {
  color: var(--fp-danger-ink);
}
</style>
