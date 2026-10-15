<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import FpDialog from '@/components/FpDialog.vue'
import { activeDialogState } from '@/composables/useDialog'

const inputEl = ref<HTMLInputElement | null>(null)

watch(
  () => activeDialogState.value,
  async (state) => {
    if (state?.kind === 'prompt') {
      await nextTick()
      inputEl.value?.focus()
      inputEl.value?.select()
    }
  },
)

function cancel() {
  const cur = activeDialogState.value
  if (!cur) return
  activeDialogState.value = null
  cur.resolve(cur.kind === 'confirm' ? false : null)
}

function submit() {
  const cur = activeDialogState.value
  if (!cur) return
  if (cur.kind === 'prompt' && !cur.inputValue.trim()) return
  const result = cur.kind === 'confirm' ? true : cur.inputValue
  activeDialogState.value = null
  cur.resolve(result)
}
</script>

<template>
  <FpDialog
    :open="Boolean(activeDialogState)"
    :title="activeDialogState?.title || '提示'"
    :tone="activeDialogState?.tone || 'default'"
    :width="400"
    layer="top"
    @close="cancel"
  >
    <form v-if="activeDialogState" id="fp-confirm-host-form" class="confirm-body" @submit.prevent="submit">
      <p class="confirm-msg">{{ activeDialogState.message }}</p>
      <input
        v-if="activeDialogState.kind === 'prompt'"
        ref="inputEl"
        v-model="activeDialogState.inputValue"
        class="fp-input"
        :placeholder="activeDialogState.placeholder"
        required
      />
    </form>
    <template #footer>
      <button type="button" class="fp-btn fp-btn--ghost" @click="cancel">
        {{ activeDialogState?.cancelText || '取消' }}
      </button>
      <button
        type="submit"
        form="fp-confirm-host-form"
        class="fp-btn"
        :class="activeDialogState?.tone === 'danger' ? 'fp-btn--danger' : 'fp-btn--primary'"
        :disabled="activeDialogState?.kind === 'prompt' && !activeDialogState.inputValue.trim()"
      >
        {{ activeDialogState?.confirmText || '确定' }}
      </button>
    </template>
  </FpDialog>
</template>

<style scoped>
.confirm-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.confirm-msg {
  margin: 0;
  color: var(--fp-text);
  font-size: 14px;
  line-height: 1.6;
}
</style>
