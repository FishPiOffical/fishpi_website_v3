<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { packsOf, type PackKind } from '@/packs'
import { useAppearanceStore } from '@/stores/appearance'

defineProps<{ compact?: boolean }>()

const appearance = useAppearanceStore()
const { state, notice } = storeToRefs(appearance)

const groups: { kind: PackKind; title: string }[] = [
  { kind: 'theme', title: '主题' },
  { kind: 'bubble', title: '对话框' },
  { kind: 'frame', title: '头像框' },
]

function selected(kind: PackKind) {
  if (kind === 'theme') return state.value.theme
  if (kind === 'bubble') return state.value.bubble
  return state.value.frame
}
</script>

<template>
  <div class="picker" :class="{ compact }">
    <section v-for="group in groups" :key="group.kind">
      <h4>{{ group.title }}</h4>
      <div class="grid">
        <button
          v-for="pack in packsOf(group.kind)"
          :key="pack.id"
          type="button"
          :class="{ on: selected(group.kind) === pack.id }"
          :title="pack.name"
          @click="appearance.apply(group.kind, pack.id)"
        >
          <i :style="{ background: pack.preview }" />
          <span>{{ pack.name }}</span>
          <em v-if="pack.vip">VIP</em>
        </button>
      </div>
    </section>
    <p v-if="notice" class="notice">{{ notice }}</p>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
h4 {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--fp-muted);
  font-weight: 600;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
}
.compact .grid {
  grid-template-columns: repeat(2, 1fr);
}
button {
  position: relative;
  border: 1px solid var(--fp-border);
  background: var(--fp-bg);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 6px;
  cursor: pointer;
  text-align: left;
}
button.on {
  border-color: var(--fp-primary);
  box-shadow: 0 0 0 1px var(--fp-primary);
}
i {
  display: block;
  height: 36px;
  border-radius: 6px;
  margin-bottom: 4px;
}
span {
  font-size: 12px;
}
em {
  position: absolute;
  top: 8px;
  right: 8px;
  font-style: normal;
  font-size: 10px;
  background: #c9a227;
  color: #1e1f22;
  border-radius: 4px;
  padding: 0 4px;
}
.notice {
  margin: 0;
  font-size: 12px;
  color: #e6c07b;
}
</style>
