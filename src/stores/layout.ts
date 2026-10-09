import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useLayoutStore = defineStore('layout', () => {
  /** 沉浸式页面（长篇阅读）隐藏全站顶栏、广告位与页脚 */
  const immersive = ref(false)
  return { immersive }
})
