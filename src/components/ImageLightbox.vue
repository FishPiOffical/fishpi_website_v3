<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

const src = defineModel<string>({ default: '' })

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') src.value = ''
}

watch(src, (v) => {
  if (v) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport v-if="src" to="body">
    <div class="img-zoom" @click="src = ''">
      <img :src="src" alt="" />
      <a :href="src" target="_blank" rel="noopener" class="open" @click.stop>查看原图</a>
    </div>
  </Teleport>
</template>

<style scoped>
.img-zoom {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.75);
  cursor: zoom-out;
}
.img-zoom img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
}
.img-zoom .open {
  position: absolute;
  right: 20px;
  bottom: 16px;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 12px;
  text-decoration: none;
}
</style>
