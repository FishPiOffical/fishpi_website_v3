<script setup lang="ts">
import { computed, ref } from 'vue'
import { REACTION_EMOJIS, type ReactionSummary } from '@/api/fishpi'

const props = withDefaults(
  defineProps<{
    summary?: ReactionSummary[]
    current?: string
    disabled?: boolean
    addLabel?: string
  }>(),
  { summary: () => [], current: '', disabled: false, addLabel: '+' },
)

const emit = defineEmits<{ toggle: [value: string] }>()
const open = ref(false)

const items = computed(() => {
  const known = new Map(REACTION_EMOJIS.map((e) => [e.value, e.emoji]))
  return (props.summary || []).filter((s) => s.count > 0).map((s) => ({
    ...s,
    emoji: s.emoji || known.get(s.value) || s.value,
    selected: s.selected || s.value === props.current,
  }))
})

function pick(value: string) {
  if (props.disabled) return
  emit('toggle', value)
  open.value = false
}
</script>

<template>
  <div class="rx" :class="{ empty: !items.length, open }">
    <button
      v-for="s in items"
      :key="s.value"
      type="button"
      class="chip"
      :class="{ on: s.selected }"
      :title="(s.users || []).join(', ')"
      :disabled="disabled"
      @click="pick(s.value)"
    >
      {{ s.emoji }} {{ s.count }}
    </button>
    <button v-if="!disabled" type="button" class="ghost" title="添加表情" @click="open = !open">{{ addLabel }}</button>
    <div v-if="open" class="panel">
      <button v-for="e in REACTION_EMOJIS" :key="e.value" type="button" :title="e.value" @click="pick(e.value)">
        {{ e.emoji }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.rx {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin-top: 6px;
}
.chip,
.ghost,
.panel button {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: 999px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
}
.chip.on {
  border-color: var(--fp-primary);
  color: var(--fp-link);
}
.panel {
  position: absolute;
  z-index: 6;
  top: 28px;
  left: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  width: 240px;
  padding: 8px;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
}
</style>
