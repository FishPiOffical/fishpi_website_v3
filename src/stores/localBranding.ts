import { defineStore } from 'pinia'
import { ref } from 'vue'

const KEY = 'fp.localBranding.v1'
const MAX_LOGO = 720_000
export function normalizeBranding(name: string, logo: string) {
  const title = name.trim(), image = logo.trim()
  if (title.length > 40 || /[\u0000-\u001f\u007f]/u.test(title)) throw new Error('站点名称最多 40 字符，不能包含控制字符')
  if (image.length > MAX_LOGO) throw new Error('Logo 太大，请使用 500 KB 以内的图片')
  if (image && !/^data:image\/(?:png|jpeg|webp|gif|x-icon);base64,[a-z\d+/=]+$/i.test(image)) {
    let url: URL
    try { url = new URL(image) } catch { throw new Error('请输入完整的 HTTP 或 HTTPS 图片地址') }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || image.length > 4096) throw new Error('请输入有效的 HTTP 或 HTTPS 图片地址')
  }
  return { name: title, logo: image }
}

export const useLocalBrandingStore = defineStore('localBranding', () => {
  const name = ref(''), logo = ref(''), error = ref('')
  let restored = false
  function restore() {
    if (restored || typeof window === 'undefined') return
    restored = true
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      if (typeof data?.name !== 'string' || typeof data?.logo !== 'string') return
      const value = normalizeBranding(data.name, data.logo)
      name.value = value.name; logo.value = value.logo
    } catch { error.value = '无法读取本机站点外观，可重新保存设置' }
  }
  function save(title: string, image: string) {
    error.value = ''
    try {
      const value = normalizeBranding(title, image)
      localStorage.setItem(KEY, JSON.stringify(value))
      name.value = value.name; logo.value = value.logo
      return true
    } catch (e) { error.value = e instanceof Error ? e.message : '保存失败，请检查浏览器存储空间'; return false }
  }
  return { name, logo, error, restore, save }
})
