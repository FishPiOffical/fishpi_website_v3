import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchAds } from '@/api/ads'
import type { AdItem, AdSlotKey } from '@/types/ads'

export const useAdsStore = defineStore('ads', () => {
  const items = ref<AdItem[]>([])
  const loaded = ref(false)

  async function load() {
    items.value = await fetchAds()
    loaded.value = true
  }

  function of(slot: AdSlotKey) {
    return items.value.filter((item) => item.slotKey === slot)
  }

  return { items, loaded, load, of }
})
