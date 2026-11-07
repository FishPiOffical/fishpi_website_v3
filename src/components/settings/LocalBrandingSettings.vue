<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useLocalBrandingStore } from '@/stores/localBranding'
const branding = useLocalBrandingStore()
const name = ref(branding.name), logo = ref(branding.logo), status = ref(''), fileError = ref(''), reading = ref(false), previewFailed = ref(false)
let generation = 0, disposed = false
watch(() => [branding.name, branding.logo], () => { name.value = branding.name; logo.value = branding.logo }, { flush: 'sync' })
watch(logo, () => { previewFailed.value = false; status.value = '' }, { flush: 'sync' })
watch(name, () => { status.value = '' }, { flush: 'sync' })
async function choose(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0], run = ++generation
  input.value = ''; fileError.value = ''; status.value = ''; reading.value = false
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/x-icon'].includes(file.type) || file.size > 500 * 1024) { fileError.value = '请选择 500 KB 以内的 PNG、JPG、WebP、GIF 或 ICO 图片'; return }
  reading.value = true
  const reader = new FileReader()
  reader.onload = () => { if (!disposed && run === generation) { logo.value = String(reader.result || ''); reading.value = false } }
  reader.onerror = () => { if (!disposed && run === generation) { fileError.value = '图片读取失败，请重新选择'; reading.value = false } }
  reader.readAsDataURL(file)
}
function save() { if (reading.value) return; fileError.value = ''; if (branding.save(name.value, logo.value)) status.value = '已保存，仅在此浏览器生效' }
function reset() { generation++; reading.value = false; fileError.value = ''; if (branding.save('', '')) { name.value = ''; logo.value = ''; status.value = '已恢复默认' } }
onBeforeUnmount(() => { disposed = true; generation++ })
</script>
<template>
 <form class="branding-settings" @submit.prevent="save">
  <p class="intro">自定义当前浏览器的站点标识。保存后优先使用此名称作为所有页面的标题，留空使用默认内容。</p>
  <div class="preview"><img v-if="logo && !previewFailed" :src="logo" alt="Logo 预览" @error="previewFailed = true" /><img v-else src="/logo.png" alt="默认 Logo" /><strong>{{ name.trim() || '摸鱼派' }}</strong></div>
  <label>站点名称 / 页面标题<input v-model="name" maxlength="40" placeholder="默认：摸鱼派" /></label>
  <label>Logo 图片地址<input :value="logo.startsWith('data:') ? '' : logo" type="url" placeholder="https://example.com/logo.png" @input="generation++; reading=false; logo=($event.target as HTMLInputElement).value" /></label>
  <div class="file-actions"><label class="file-button">选择本地图片<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon" @change="choose" /></label><button v-if="logo" type="button" @click="generation++; reading=false; logo=''">清除 Logo</button></div>
  <small>建议使用方形图片，最大 500 KB。本地图片只保存在浏览器，不上传到服务器。</small>
  <p v-if="previewFailed" class="error" role="alert">图片无法加载，请检查地址或改选本地图片。</p>
  <p v-if="fileError || branding.error" class="error" role="alert">{{ fileError || branding.error }}</p>
  <p v-if="status" class="success" role="status">{{ status }}</p>
  <div class="actions"><button class="save" type="submit" :disabled="reading">{{ reading ? '读取图片中…' : '保存设置' }}</button><button type="button" @click="reset">恢复默认</button></div>
 </form>
</template>
<style scoped>
.branding-settings { display:flex; flex-direction:column; gap:16px; }
.intro,small { margin:0; color:var(--fp-muted); font-size:12px; line-height:1.7; }
.preview { display:flex; align-items:center; gap:12px; padding:18px; border:1px solid var(--fp-border); border-radius:10px; background:var(--fp-bg); }
.preview img { width:40px; height:40px; object-fit:contain; }
strong { overflow-wrap:anywhere; font-size:17px; color:var(--fp-title); }
label { display:flex; flex-direction:column; gap:7px; font-size:13px; color:var(--fp-head); }
input:not([type=file]) { width:100%; box-sizing:border-box; border:1px solid var(--fp-border); border-radius:7px; padding:10px; background:var(--fp-bg); color:var(--fp-text); font:inherit; }
.file-actions,.actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
button,.file-button { border:1px solid var(--fp-border); border-radius:7px; padding:8px 12px; font:inherit; font-size:12px; background:var(--fp-card); color:var(--fp-text); cursor:pointer; }
.file-button { position:relative; overflow:hidden; }
.file-button input { position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; }
.save { background:var(--fp-primary); border-color:var(--fp-primary); color:#fff; }
button:disabled { opacity:.5; cursor:default; }
button:focus-visible,input:focus-visible,.file-button:focus-within { outline:2px solid var(--fp-primary); outline-offset:2px; }
.error { margin:0; color:#bd503c; font-size:12px; }.success { margin:0; color:var(--fp-primary); font-size:12px; }
</style>
