<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAdsStore } from '@/stores/ads'
import type { AdItem, AdSlotKey } from '@/types/ads'

const props = defineProps<{ slotKey: AdSlotKey }>()
const ads = useAdsStore()
const { loaded } = storeToRefs(ads)
const items = computed(() => ads.of(props.slotKey))

onMounted(() => {
  if (!loaded.value) void ads.load()
})

watch(
  items,
  (list) => {
    for (const item of list) {
      if (item.type !== 'script' || !item.scriptSrc) continue
      if (document.querySelector(`script[data-ad="${item.id}"]`)) continue
      const el = document.createElement('script')
      el.src = item.scriptSrc
      el.async = true
      el.dataset.ad = item.id
      document.body.appendChild(el)
    }
  },
  { immediate: true },
)

function attrEntries(item: AdItem) {
  return Object.entries(item.containerAttrs ?? {})
}
</script>

<template>
  <div v-if="items.length" class="slot" :data-slot="slotKey">
    <template v-for="item in items" :key="item.id">
      <a
        v-if="item.type === 'image'"
        class="banner"
        :href="item.linkUrl || '#'"
        target="_blank"
        rel="sponsored noopener"
      >
        <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.title || '广告'" />
        <div class="copy">
          <strong>{{ item.title }}</strong>
          <span v-if="item.badge" class="badge">{{ item.badge }}</span>
        </div>
      </a>
      <a
        v-else-if="item.type === 'link'"
        class="link"
        :href="item.linkUrl || '#'"
        target="_blank"
        rel="sponsored noopener"
      >
        {{ item.title }}
      </a>
      <div v-else-if="item.type === 'html'" class="html">
        <a v-if="item.linkUrl" :href="item.linkUrl" target="_blank" rel="sponsored noopener">{{ item.title }}</a>
        <div v-if="item.html" v-html="item.html" />
      </div>
      <div v-else-if="item.type === 'script'" class="script" v-bind="Object.fromEntries(attrEntries(item))" />
    </template>
  </div>
</template>

<style scoped>
.slot[data-slot='home.top'] {
  margin: 12px 20% 0;
}
.banner {
  display: flex;
  gap: 12px;
  align-items: center;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  padding: 10px 14px;
  color: inherit;
  text-decoration: none;
}
.banner img {
  width: 72px;
  height: 48px;
  object-fit: contain;
}
.copy {
  display: flex;
  align-items: center;
  gap: 8px;
}
.badge {
  font-size: 11px;
  color: var(--fp-muted);
  border: 1px solid var(--fp-border);
  border-radius: 4px;
  padding: 1px 6px;
}
.slot[data-slot='footer.sponsors'] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.link {
  color: var(--fp-link);
  text-decoration: none;
}
.html {
  font-size: 13px;
  color: var(--fp-muted);
}
</style>
